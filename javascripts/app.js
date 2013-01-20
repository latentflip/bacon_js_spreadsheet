(function() {

  $(function() {
    var keyMap;
    window.r = {
      cellReferenceMatchAll: /([A-Z]+[1-9]+[0-9]*|time)/g
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
        return equation.match(r.cellReferenceMatchAll) || [];
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
      },
      incrementCellReference: function(cellRef, dir) {
        cellRef = cellRef.replace(/^[A-Z]/, function(alpha) {
          if (dir === "left" && alpha !== "A") {
            return String.fromCharCode(alpha.charCodeAt(0) - 1);
          }
          if (dir === "right") {
            return String.fromCharCode(alpha.charCodeAt(0) + 1);
          }
          return alpha;
        });
        return cellRef = cellRef.replace(/[0-9]+$/, function(n) {
          n = parseInt(n);
          if (dir === "up" && n > 1) {
            return n - 1;
          }
          if (dir === "down") {
            return n + 1;
          }
          return n;
        });
      }
    };
    keyMap = {
      38: "up",
      40: "down",
      13: "down"
    };
    $('td input').asEventStream('keyup').filter(function(ev) {
      return _.chain(keyMap).keys().contains(ev.keyCode.toString()).value();
    }).onValue(function(ev) {
      var currentRef, dir, newRef;
      dir = keyMap[ev.keyCode];
      currentRef = $(ev.currentTarget).data("reference");
      newRef = f.incrementCellReference(currentRef, dir);
      return $("input[data-reference=" + newRef + "]").focus();
    });
    window.inputStreams = {};
    window.valueStreams = {};
    window.valueProperties = {};
    window.resultStreams = {};
    valueProperties.time = Bacon.fromPoll(100, function(v) {
      return new Bacon.Next(new Date().getTime());
    }).toProperty();
    $('td input').each(function() {
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
        resultStreams[reference] && resultStreams[reference]();
        if (cellRefs.length > 0) {
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
          return resultStreams[reference] = result.onValue(function(value) {
            return valueStream.push(value);
          });
        } else {
          return valueStream.push(f.applyOrderedArgsToEquation([], equation));
        }
      });
      inputStream.filter(f.isntEquation).map(f.coerceFieldValue).onValue(function(value) {
        resultStreams[reference] && resultStreams[reference]();
        console.log("value = ", value);
        return valueStream.push(value);
      });
      return valueProperty.map(function(v) {
        if (_.isNumber(v)) {
          return parseFloat(v.toFixed(3));
        } else {
          return v;
        }
      }).assign($result, "text");
    });
    $("[data-reference=A1]").val("100").change();
    $("[data-reference=B1]").val("=time").change();
    return $("[data-reference=C1]").val("=Math.sin(B1) + A1").change();
  });

}).call(this);
