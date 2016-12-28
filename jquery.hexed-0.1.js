// RequireJS compatibility
// If 'define' function is defined, jquery.hexed uses it
(function(factory) {
  if(typeof define !== 'undefined') {
    define(['jquery'], factory);
  } else {
    factory(jQuery);
  }
})(function($) {
  // Backup original functions
  var origVal = $.fn.val;
  var origSel = $.fn.selected;
  var origBE = $.fn.be;
  var origLE = $.fn.le;
  var origSelOff = $.fn.selectedOffset;
  var origClean = $.fn.clean;

  // Convert integer n to zero-padded hexadecimal string with length l
  function pad(n, l) {
    var nn = n.toString(16);
    return Array(l - nn.length + 1).join("0") + nn;
  }

  // Set text of span to string consist of a character which has character code newval
  // If newval is not displayable (not in [32, 126]), text of span is set to '.'
  function hstr(newval, span) {
    if(newval == 32) span.html('&nbsp;');  // .text(' ') makes span disappear
    else if(newval < 32 || newval > 126) span.text(".");
    else span.text(String.fromCharCode(newval));
  }

  // Some kind of reduce function which is applied to given hexed object
  function cummulate(hexed, first, length, fn) {
    var ret = first, i;
    var next = $('span.hd-hex.hd-selected,span.hd-hex.hd-associated', hexed);
    if(next.length == 0) return null; // If no hex area is selected, just return null
    length = length || 1; // if length is not given, assume that length is 1
    for(i = 0; i < length; i++) {
      ret = fn(ret, parseInt('0x' + next.text())); // accumulate result
      next = next.next('span.hd-hex'); // get next hex area
      if(next.length == 0) { // If current selected offset is end of the row, next is empty
        var next_row = next.parent('div.hd-hex>p').next('p'); // get next row and
        next = $('span.hd-hex:first', next_row); // select first one of that row
      }
      // although find hex area of next row, if next is empty yet, selection reached the end
      if(next.hasClass('hd-padding') || next.length == 0) break;
    }
    return ret; // return cummulated value
  }

  // a shortcut for $.attr('readonly')
  $.fn.readonly = function() {
    return this.attr.bind(this, 'readonly').apply(this, arguments);
  }

  // Clear modified flag of all cells
  $.fn.clean = function() {
    $('span.hd-modified', this).removeClass('hd-modified');
    if(origClean !== undefined) return origClean.apply(this, arguments);
    return this;
  }

  // Get/set selected offset
  $.fn.selectedOffset = function(offset) {
    // this function applies first one only
    var hexed = $(this[0]);
    // if selectedOffset applied to not hexed object, do original one
    if(!hexed.hasClass('hexed')) {
      if(origSelOff !== undefined) return origSelOff.apply(this, arguments);
      return this;
    }
    // if new offset value is not given, return offset of currently selected one
    if(offset === undefined) {
      var next = $('span.hd-hex.hd-selected', hexed);
      if(next.length == 0) return null; // if none of hex is selected, return null
      return parseInt(next.attr('data-offset'));
    } else { // if new offset value is given, select hex at given offset
      if(parseInt(offset) == NaN) return this;
      offset = parseInt(offset);
      // first, clear all selected, associated objects
      $('span.hd-hex,span.hd-str').removeClass('hd-selected hd-associated');
      // select hex
      $('span.hd-hex[data-offset="' + offset + '"]', hexed).addClass('hd-selected');
      // associate str
      $('span.hd-str[data-offset="' + offset + '"]', hexed).addClass('hd-associated');
      // if none of hex has given offset, trigger 'select' event with offset null
      if($('span.hd-hex[data-offset="' + offset + '"]', hexed).length == 0)
        $(hexed).trigger("select", null);
      else // trigger 'select' event with given offset
        $(hexed).trigger("select", offset);
      return this; // for chaining
    }
  }
  // get string at selected offset with length
  $.fn.selected = function(length) {
    // this function applies first one only
    var hexed = $(this[0]);
    // if selectedOffset applied to not hexed object, do original one
    if(!hexed.hasClass('hexed')) {
      if(origSel !== undefined) return origSel.apply(this, arguments);
      return this;
    }
    // cummulate with string concatenation
    return cummulate(hexed, '', length, function(y, x) {
      return y + String.fromCharCode(x);
    })
  }

  // In hexed, be and le function returns string not integer.
  // Javascript uses 64bit float type for numeric values: it means js cannot manipulate
  // 64bit integer properly.
  // Internally, hexed uses 1000-based integer representation with array
  // The reason for using 1000-based representation is that
  // it is easy for adding comma at every three digits.
  // 1000-based integer array representation uses little-endian style.
  // Cummulation function that converts bytes to big-endian unsigned big-int
  function cumm_be(y, x) {
    var i = 0, overflow = 0;
    y[0] = y[0] * 256 + x;
    for(i = 0; i < y.length; i++) {
      overflow = Math.floor(y[i] / 1000);
      y[i] %= 1000;
      if(y[i + 1] !== undefined || overflow != 0) {
        y[i + 1] |= 0;
        y[i + 1] *= 256;
        y[i + 1] += overflow;
      } else {
        break;
      }
    }
    return y;
  }
  // Convert unsigned big-int to signed big-int
  function makeSign(bign, length) {
    // maxint contains maximum signed integer
    // maxuint contains maximum unsigned integer + 1
    var i, maxint = [0x80], maxuint = [1], negative = true;
    length = length || 1;
    for(i = 0; i < length - 1; i++) {
      maxint = cumm_be(maxint, 0);
      maxuint = cumm_be(maxuint, 0);
    }
    maxuint = cumm_be(maxuint, 0);

    // If given bign is smaller than maxint, it is positive.
    // it does not require any conversion.
    if(maxint.length > bign.length)
      return bign;
    // If given bign is larger or equals to maxint, it is negative
    else if(maxint.length == bign.length) {
      for(i = maxint.length - 1; i >= 0; i--) {
        if(maxint[i] < bign[i]) {
          break;
        } else if(maxint[i] > bign[i]) {
          negative = false;
          break;
        }
      }
    }
    // If negative, returns maxuint - bign. 2's complement
    if(negative) {
      for(i = 0; i < maxuint.length; i++) {
        maxuint[i] -= bign[i];
        if(maxuint[i] < 0) { // borrowing
          maxuint[i] += 1000;
          maxuint[i + 1] -= 1;
        }
      }
      // removes 0-heading
      while(maxuint[maxuint.length - 1] == 0) {
        maxuint.pop();
      }
      // negate msb only, to make easy to convert string
      maxuint[maxuint.length - 1] = -maxuint[maxuint.length - 1];
      return maxuint;
    }
    return bign;
  }
  // convert 1000-based integer representation to string
  function bigint2string(bign) {
    // If given bign is less than 1000, we don't need to care about comma
    if(bign.length == 1) return bign[0].toString();
    // We used little-endian, so reverse it
    bign = bign.reverse();
    // First element of reversed bign does not use padding
    // Other elements need to be padded with up to 3 zeros
    return bign[0].toString() + "," + $.map(bign.slice(1), function(n) {
      var s = n.toString();
      return Array(3 - s.length + 1).join("0") + s;
    }).join(",");
  }
  // get big-endian integer at selected offset with length bytes
  $.fn.be = function(length, sign) {
    // this function applies first one only
    var hexed = $(this[0]);
    // if selectedOffset applied to not hexed object, do original one
    if(!hexed.hasClass('hexed')) {
      if(origBE !== undefined) return origBE.apply(this, arguments);
      return undefined;
    }
    // cummulate with bit-shift and bit-or
    var ret = cummulate(hexed, [0], length, cumm_be);
    if(sign === true) {
      ret = makeSign(ret, length);
    }

    return bigint2string(ret);
  }
  // get little-endian integer at selected offset with length bytes
  $.fn.le = function(length, sign) {
    // this function applies first one only
    var hexed = $(this[0]);
    // if selectedOffset applied to not hexed object, do original one
    if(!hexed.hasClass('hexed')) {
      if(origLE !== undefined) return origLE.apply(this, arguments);
      return undefined;
    }
    // Cummulate bytes and reverse: little-endian to big-endian converting
    var y = cummulate(hexed, [], length, function(y, x) {
      y[y.length] = x;
      return y;
    }).reverse();
    // Convert big-endian big-int
    var ret = [0];
    for(var i = 0; i < y.length; i++) {
      ret = cumm_be(ret, y[i]);
    }
    if(sign === true) {
      ret = makeSign(ret, length);
    }

    return bigint2string(ret);
  }

  // In hex-edit mode, indicate which nibble is will be modified.
  // 0 means upper, and 1 means lower
  // Note: it is globally unique variable, because two or more hexed cannot be edited at the same time
  var offset = 0;
  // set/get editing string
  $.fn.val = function(value) {
    // this function applies first one only
    var hexed = $(this[0]);
    // if selectedOffset applied to not hexed object, do original one
    if(!hexed.hasClass('hexed')) {
      if(origVal !== undefined) return origVal.apply(this, arguments);
      return this;
    }
    if(value === undefined) {
      // getter
      // map hex code to string, concatenate, and return concatenated string
      return $.map($('span.hd-hex', hexed).not('.hd-padding'), function(n) {
        return String.fromCharCode(parseInt('0x' + $(n).text()));
      }).join("");
    }
    // setter
    // if given val is integer, create zero-filled buffer with length val
    if(typeof(value) == 'number') value = Array(value + 1).join("\0");

    // clear all rows
    $('p', hexed).remove();
    var i, data = value.toString();
    // get containers
    var addr_div = $('div.hd-addr', this);
    var hex_div = $('div.hd-hex', this);
    var str_div = $('div.hd-str', this);
    // for each character in given data
    for(i = 0; i < data.length; i+=16) {
      // create row
      var o;
      var addr = $('<p/>'), hex_row = $('<p/>'), str_row = $('<p/>');
      var n = 8 - i.toString(16).length;
      addr.attr('data-offset', i);
      addr.text(pad(i, 8));
      addr_div.append(addr);
      for(o = 0; o < 16; o++) {
        // create hex, str
        // overflowed
        if(i + o >= data.length) break;
        // get char code
        var hex = data.charCodeAt(i + o);
        // create items
        var hex_span = $('<span/>'), str_span = $('<span/>');
        // set several properties
        hex_span.addClass('hd-hex');
        hex_span.data('assoc-str', str_span);
        hex_span.data('owner', $(this));
        hex_span.text(pad(hex, 2));
        hex_span.attr('data-offset', i + o);

        str_span.addClass('hd-str');
        str_span.data('assoc-hex', hex_span);
        str_span.data('owner', $(this));
        hstr(hex, str_span);
        str_span.attr('data-offset', i + o);

        // add hex and str to row
        hex_row.append(hex_span);
        str_row.append(str_span);
      }
      // if end of data and data length is not aligned to row unit 16,
      for(; o < 16; o++) {
        // add dummies
        var hex_span = $('<span/>'), str_span = $('<span/>');
        hex_span.addClass('hd-hex hd-padding');
        hex_span.data('assoc-str', str_span);
        str_span.addClass('hd-str hd-padding');
        str_span.data('assoc-hex', hex_span);
        hex_span.html('&nbsp;&nbsp;');
        str_span.html('&nbsp;');
        hex_span.attr('data-offset', i + o);
        str_span.attr('data-offset', i + o);
        hex_row.append(hex_span);
        str_row.append(str_span);
      }
      // add rows to containers
      hex_div.append(hex_row);
      str_div.append(str_row);
    }
    // add click handler to hex
    $('span.hd-hex:not(.hd-padding)').click(function() {
      // clear selection
      $('span.hd-hex,span.hd-str').removeClass('hd-selected hd-associated');
      // set this one selected
      $(this).addClass('hd-selected');
      // get associated str span
      var str_span = $(this).data('assoc-str');
      // set that span associated
      str_span.addClass('hd-associated');
      // Take focus
      $('a', $(this).parents('.hexed')).focus();
      // Reset editing offset
      offset = 0;
      // trigger "select" event
      $(this).trigger("select", parseInt($(this).attr('data-offset')));
    });
    // add click handler to str
    $('span.hd-str:not(.hd-padding)').click(function() {
      // clear selection
      $('span.hd-hex,span.hd-str').removeClass('hd-selected hd-associated');
      // set this one selected
      $(this).addClass('hd-selected');
      // get associated hex span
      var hex_span = $(this).data('assoc-hex');
      // set that span associated
      hex_span.addClass('hd-associated');
      // Take focus
      $('a', $(this).parents('.hexed')).focus();
      // Reset editing offset
      offset = 0;
      // trigger "select" event
      $(this).trigger("select", parseInt($(this).attr('data-offset')));
    })
    return this;
  }

  // Process keypress event at hex edit mode
  function hex_process(selected, ev) {
    var val = parseInt("0x" + selected.text());
    var ch = ev.which | 32; // make alphabet code to lower
    var n, newval;
    var str_span, next;
    // convert keycode to hexadecimal digit
    if(ev.which >= 48 && ev.which <= 57) { // 0 to 9
      n = ev.which - 48;
    } else if(ch >= 97 && ch <= 102) { // a to f
      n = ev.which - 87;
    } else return;

    // modify target nibble
    if(offset == 0) {
      newval = (n << 4) | (val & 15);
      offset = 1;
    } else if(offset == 1) {
      newval = (val & 240) | n;
      offset = 0;
      // if lower nibble is modified, than select next hex
      selected.removeClass('hd-selected'); // clear selection
      str_span = $(selected.data('assoc-str'));
      str_span.removeClass('hd-associated');
      next = selected.next('span.hd-hex:not(.hd-padding)'); // choose next hex
      if(next.length == 0) { // if selected hex is at the end of row,
        var next_row = selected.parent('div.hd-hex>p').next('p'); // get next row
        next = $('span.hd-hex:first:not(.hd-padding)', next_row); // select first one of that row
      }
      if(next.length != 0) { // if there is next hex,
        // select
        next.addClass('hd-selected');
        str_span = $(next.data('assoc-str'));
        str_span.addClass('hd-associated');
        // trigger select event with next offset
        next.data('owner').trigger("select", parseInt(next.attr('data-offset')));
      }
    }
    // check selected hex as modified
    selected.addClass('hd-modified');
    // change display text to new value
    selected.text(pad(newval, 2));
    str_span = $(selected.data('assoc-str'));
    // check associated str as modified
    str_span.addClass('hd-modified');
    // change displa text to new value
    hstr(newval, str_span);
    // trigger 'change' event
    selected.data('owner').trigger("change", parseInt($(next).attr('data-offset')));
  }

  // Process keypress event at row str edit mode
  function str_process(selected, ev) {
    var next, hex_span;
    if(ev.which < 0 || ev.which >= 256) return; // Can't handle that value

    selected.removeClass('hd-selected');
    hex_span = $(selected.data('assoc-hex'));
    hex_span.removeClass('hd-associated');
    hstr(ev.which, selected); // update with input value
    hex_span.text(pad(ev.which, 2));

    next = selected.next('span.hd-str:not(.hd-padding)'); // choose next one
    if(next.length == 0) { // if selected str is at the end of row,
      var next_row = selected.parent('div.hd-str>p').next('p'); // get next row
      next = $('span.hd-str:first', next_row); // select first one of that row
    }
    // check hex and str as modified
    hex_span.addClass('hd-modified');
    selected.addClass('hd-modified');
    if(next.length != 0) { // if there is next hex,
      next.addClass('hd-selected');
      hex_span = $(next.data('assoc-hex'));
      hex_span.addClass('hd-associated');
      // trigger 'select' event with next offset
      next.data('owner').trigger("select", parseInt(next.attr('data-offset')));
    }
    // trigger 'change' event
    selected.data('owner').trigger("change", parseInt(next.attr('data-offset')));
  }
  // creator
  $.fn.hexed = function(val) {
    var hexed = this;

    // if val is not given, we use inner text as input
    if(val === undefined) val = $(this).text();
    $(this).empty();

    // create outline
    var wrap = $('<div/>');
    var body = $('<div/>');
    var addr_div = $('<div/>');
    var hex_div = $('<div/>');
    var str_div = $('<div/>');
    // Invisible focus holder
    var focus = $('<a href="#"/>');
    wrap.addClass('hd-wrap');
    body.addClass('hd-body');
    addr_div.addClass('hd-addr');
    hex_div.addClass('hd-hex');
    str_div.addClass('hd-str');
    hexed.append(wrap);
    wrap.append(body);
    body.append(addr_div).append(hex_div).append(str_div).append(focus);

    hexed.addClass('hexed');

    focus.focus(function() {
      $(hexed).addClass('hd-focus');
    });
    focus.blur(function() {
      $(hexed).removeClass('hd-focus');
    });
    focus.keypress(function(ev) {
      if($(hexed).attr('readonly')) return true;
      var selected = $('span.hd-hex.hd-selected', hexed);
      if(selected.length != 0) {
        hex_process(selected, ev);
        return false;
      }
      selected = $('span.hd-str.hd-selected', hexed);
      if(selected.length != 0) {
        str_process(selected, ev);
        return false;
      }
    });

    $(this).val(val);

    return hexed;
  }

  $(document).ready(function() {
    // add default style sheet
    $('head').prepend($('<style>\n' +
      'div.hd-wrap { display: table; font-family: monospace; }\n' +
      'div.hd-body { display: table-row; }\n' +
      'div.hd-addr { display: table-cell; padding-right: .5em; }\n' +
      'div.hd-hex { display: table-cell; padding-right: .5em; }\n' +
      'div.hd-str { display: table-cell; }\n' +

      'div.hd-body p { margin: 0; line-height: 1.5; }\n' +
      'span.hd-hex { padding-left: .25em; padding-right: .25em; }\n' +
      'span.hd-hex:nth-child(8) { border-right: 1px solid gray; }\n' +
      'span.hd-hex.hd-modified, span.hd-str.hd-modified { background: orange; }\n' +
      '.hd-focus span.hd-hex.hd-selected, .hd-focus span.hd-str.hd-selected { background: lightblue; }\n' +
      '.hd-focus span.hd-hex.hd-associated, .hd-focus span.hd-str.hd-associated { background: pink; }\n' +
      '</style>'));
  });

  return $;
});
