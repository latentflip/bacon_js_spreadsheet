(function() {

  $(function() {
    window.r = {
      cellReferenceMatchAll: /[A-Z]+[1-9]+[0-9]*/g
    };
    window.f = {
      isNumber: function(string) {
        return f.isInteger(string[0]);
      },
      isInteger: function(string) {
        return parseInt(string).toString() === string;
      },
      getInputValue: function(input) {
        if (input.currentTarget) {
          input = input.currentTarget;
        }
        return $(input).val();
      },
      isEquation: function(string) {
        return string[0] === "=";
      },
      isntEquation: function(string) {
        return !f.isEquation(string);
      },
      findCellReferencesInEquation: function(equation) {
        return equation.match(r.cellReferenceMatchAll);
      },
      replaceVariablesInEquation: function(equation) {
        var lastReplace;
        equation = equation.slice(1);
        lastReplace = -1;
        return equation.replace(r.cellReferenceMatchAll, function() {
          lastReplace++;
          return "args[" + lastReplace + "]";
        });
      },
      applyOrderedArgsToEquation: function(args, equation) {
        equation = f.replaceVariablesInEquation(equation);
        console.log("applying", args, "to", equation);
        return eval(equation);
      },
      coerceFieldValue: function(value) {
        value = value.trim();
        if (f.isNumber(value)) {
          if (f.isInteger(value)) {
            return parseInt(value);
          } else {
            return parseFloat(value);
          }
        } else {
          return value;
        }
      }
    };
    window.inputStreams = {};
    window.valueStreams = {};
    window.valueProperties = {};
    return $('td input').each(function() {
      var $cell, $result, inputStream, reference, valueProperty, valueStream;
      $cell = $(this);
      $result = $cell.closest('td').find('div.result');
      reference = $cell.data('reference');
      inputStream = $cell.asEventStream('change').map(f.getInputValue).toProperty("");
      valueStream = new Bacon.Bus();
      valueProperty = valueStream.toProperty();
      inputStreams[reference] = inputStream;
      valueStreams[reference] = valueStream;
      valueProperties[reference] = valueProperty;
      inputStream.filter(f.isEquation).onValue(function(equation) {
        var cellRef, cellRefs, result, stream, _i, _len, _ref;
        cellRefs = f.findCellReferencesInEquation(equation);
        result = valueProperties[cellRefs[0]].map(function(v) {
          return [v];
        });
        _ref = cellRefs.slice(1);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          cellRef = _ref[_i];
          stream = valueProperties[cellRef];
          result = result.combine(stream, function(arr, v) {
            arr.push(v);
            return arr;
          });
        }
        result = result.map(function(args) {
          return f.applyOrderedArgsToEquation(args, equation);
        });
        return result.onValue(function(value) {
          return valueStream.push(value);
        });
      });
      inputStream.filter(f.isntEquation).map(f.coerceFieldValue).onValue(function(value) {
        return valueStream.push(value);
      });
      return valueProperty.assign($result, "text");
    });
  });

}).call(this);
