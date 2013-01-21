$ ->
  #### Useful Regexes
  
  # matches A1, AB2, A12, etc
  window.r = { cellReferenceMatchAll:  /[A-Z]+[1-9]+[0-9]*/g }

  #### Useful functions
  window.f = {
    # `isNumber`: Check if a string is a number
    isNumber: (string) -> f.isInteger(string[0])
    # `isInteger`: Check if a string is an integer
    isInteger: (string) -> parseInt(string).toString() == string
    # `isEquation`: Check if a string is/isn't an equation (starts with '=')
    isEquation: (string) -> string[0] == "="
    isntEquation: (string) -> !f.isEquation(string)
    # `getInputValueOfEvent` gets the value of an event on an input field
    getInputValueOfEvent: (event) -> $(event.currentTarget).val()
    # `findCellReferencesInEquation` finds all the references to cells A1, B2, etc in an equation, so "=A1 + B2" -> ["A1", "B2"]
    findCellReferencesInEquation: (equation) -> equation.match(r.cellReferenceMatchAll)
    # `replaceVariablesInEquation` replaces cell references in an equation so it can be eval'd, "=A1 + B2" -> "=args[0] + args[1]"
    replaceVariablesInEquation: (equation) ->
      equation = equation.slice(1)
      lastReplace = -1
      equation.replace(r.cellReferenceMatchAll, ->
        lastReplace++
        "args[#{lastReplace}]"
      )
    # `applyOrderedArgsToEquation` takes an equation, say "=A1 + B2" and applies a list of variables to the equation, say [1,2] resulting in 3
    applyOrderedArgsToEquation: (args, equation) ->
      equation = f.replaceVariablesInEquation(equation)
      eval(equation)

    # `coerceFieldValue` coerces a field to an actual float/int/string
    coerceFieldValue: (value) ->
      value = value.trim()
      if f.isNumber(value)
        if f.isInteger(value)
          parseInt(value)
        else
          parseFloat(value)
      else
        value
  }

  #### Building the spreadsheet

  # `inputProperties`: Streams of user input (1 per cell)    
  # `valueStreams`: Streams of result values (same as user input if a number/string, result of an equation if an equation)    
  # `valueProperties`: Value streams as properties (combine can only be used on properties    
  window.inputProperties = {}
  window.valueStreams = {}
  window.valueProperties = {}

  # Let's setup the streams for each cell in our spreadsheet 
  $('td input').each ->
    #   Save off the current cell
    $cell = $(this)
    
    #Our result are stored in an overlaid div, rather than in the input field itself, so find that too
    $result = $cell.closest('td').find('div.result')

    #Get the reference for the current cell (set as <data-reference="A1">) in the html
    reference = $cell.data('reference')

    # Create a property representing the latest value of the input field
    inputProperty = $cell.asEventStream('change').map(f.getInputValueOfEvent).toProperty("")
    # Create a Bus (effectively a stream which values are manually pushed onto) for the cell's valueStream
    valueStream = new Bacon.Bus()
    # Also create a property of the valueStream (effectively a dynamic variable of the latest value)
    valueProperty = valueStream.toProperty()

    # Save off our cell's streams properties into our global lists for access later
    inputProperties[reference] = inputProperty
    valueStreams[reference] = valueStream
    valueProperties[reference] = valueProperty
    
    #### When we have an equation on the inputProperty
    inputProperty.filter(f.isEquation).onValue (equation) ->
      cellRefs = f.findCellReferencesInEquation(equation)

      result = valueProperties[ cellRefs[0] ].map( (v) -> [v] )

      for cellRef in cellRefs.slice(1)
        stream = valueProperties[ cellRef ]
        result = result.combine(stream, (arr, v) -> arr.push(v); arr)

      result = result.map((args) -> f.applyOrderedArgsToEquation(args, equation))
      result.onValue( (value) -> valueStream.push value)

    ##### When we have a non-equation on the inputProperty
    inputProperty.filter(f.isntEquation)
                .map(f.coerceFieldValue)
                .onValue((value) -> valueStream.push value)

    valueProperty.assign $result, "text"
