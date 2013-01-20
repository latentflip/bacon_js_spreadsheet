$ ->
  window.r = 
    cellReferenceMatchAll:  /[A-Z]+[1-9]+[0-9]*/g 

  window.f = 
    isNumber: (string) ->
      f.isInteger(string[0])
    isInteger: (string) ->
      parseInt(string).toString() == string
    getInputValue: (input) ->
      input = input.currentTarget if input.currentTarget
      $(input).val()
    isEquation: (string) ->
      string[0] == "="
    isntEquation: (string) -> !f.isEquation(string)
    findCellReferencesInEquation: (equation) ->
      equation.match(r.cellReferenceMatchAll)
    replaceVariablesInEquation: (equation) ->
      equation = equation.slice(1)
      lastReplace = -1
      equation.replace(r.cellReferenceMatchAll, ->
        lastReplace++
        return "args[#{lastReplace}]"
      )
    applyOrderedArgsToEquation: (args, equation) ->
      equation = f.replaceVariablesInEquation(equation)
      console.log "applying", args, "to", equation
      eval(equation)

    coerceFieldValue: (value) ->
      value = value.trim()
      if f.isNumber(value)
        if f.isInteger(value)
          parseInt(value)
        else
          parseFloat(value)
      else
        value

  window.inputStreams = {}
  window.valueStreams = {}
  window.valueProperties = {}
    
  $('td input').each ->
    $cell = $(this)
    $result = $cell.closest('td').find('div.result')

    reference = $cell.data('reference')
    inputStream = $cell.asEventStream('change').map(f.getInputValue).toProperty("")
    valueStream = new Bacon.Bus()
    valueProperty = valueStream.toProperty()

    inputStreams[reference] = inputStream
    valueStreams[reference] = valueStream
    valueProperties[reference] = valueProperty
    
    inputStream.filter(f.isEquation).onValue (equation) ->
      cellRefs = f.findCellReferencesInEquation(equation)

      result = valueProperties[ cellRefs[0] ].map( (v) -> [v] )

      for cellRef in cellRefs.slice(1)
        stream = valueProperties[ cellRef ]
        result = result.combine(stream, (arr, v) -> arr.push(v); arr)

      result = result.map((args) -> f.applyOrderedArgsToEquation(args, equation))
      result.onValue( (value) -> valueStream.push value)

    inputStream.filter(f.isntEquation)
                .map(f.coerceFieldValue)
                .onValue((value) -> valueStream.push value)

    valueProperty.assign $result, "text"
