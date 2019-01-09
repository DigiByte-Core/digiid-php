(function(document,undefined) {
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };
	_this["addData"]=_this.addData;

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };
	_this["isDark"]=_this.isDark;
	
    _this.getModuleCount = function() {
      return _moduleCount;
    };
	_this["getModuleCount"]=_this.getModuleCount;

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };
	_this["make"]=_this.make;

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    "L" : 1,
    "M" : 0,
    "Q" : 3,
    "H" : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel["L"] :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel["M"] :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel["Q"] :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel["H"] :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };
/*
    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };
*/
    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };
//---------------------------------------------------------------------
//
// DigiQR Code
//
// Copyright (c) 2018 Matthew Cornelisse
//
// URL: http://github.com/mctrivia/DigiQR/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
//---------------------------------------------------------------------

	//minifier helpers
	var bezierCurveTo="bezierCurveTo";
	var lineTo="lineTo";
	var beginPath="beginPath";
	var closePath="closePath";
	var deleteMe=function() {
		closePath=beginPath=lineTo=bezierCurveTo="";
	}
	
	//create rounded corners
	function createCorners(p4,radius,color) {
		/*
			0		p1		p2		p3		p4
			
			
			p1
			
			
			
			p2
			
			
			
			p3
			
			
			
			p4
		*/
		var p2=p4*0.5,
			r=p2*radius,
			p1=p2-r,
			p3=p2+r;			
		var corner=[];
		for (var i=0;i<16;i++) {
			//setup corner canvas
			var canvasCorner=document["createElement"]("canvas");				//create a canvas for corners
			canvasCorner["height"]=canvasCorner["width"]=p4;				//set canvas dimensions to dot size
			var cc=canvasCorner["getContext"]("2d");						//get canvas context
			cc["fillStyle"]=color;
			
			//Draw Corners
			function drawCorner(v0,v1,v2,v3,v4,v5,v6,v7,v8,v9,v10,v11) {
				cc[beginPath]();
				cc["moveTo"](v0,v1);
				cc[lineTo](v2,v3);
				cc[lineTo](v4,v5);
				cc["arc"](v6,v7,r,v8*Math.PI,v9*Math.PI);
				cc[lineTo](v10,v11);
				cc[lineTo](v0,v1);
				cc[closePath]();
				cc["fill"]();
			}
			if ((i==1)||(i==9)) drawCorner(p4,p4,p2,p4,p2,p3,p3,p3,  1,1.5,p4,p2);			//draw bottom right
			if ((i==8)||(i==9)) drawCorner( 0, 0,p2, 0,p2,p1,p1,p1,  0,0.5, 0,p2);			//draw top left
			if ((i==4)||(i==6)) drawCorner(p4, 0,p4,p2,p3,p2,p3,p1,0.5,  1,p2,0);			//draw top right
			if ((i==2)||(i==6)) drawCorner( 0,p4, 0,p2,p1,p2,p1,p3,1.5,  0,p2,p4);			//draw bottom left
			
			//Draw Flats
			if (i==3)  cc["fillRect"](0,p2,p4,p2);											//draw bottom
			if (i==12) cc["fillRect"](0,0,p4,p2);											//draw top
			if (i==10) cc["fillRect"](0,0,p2,p4);											//draw left
			if (i==5)  cc["fillRect"](p2,0,p2,p4);											//draw right
			if (i==15) cc["fillRect"](0,0,p4,p4);											//draw full
			
			//draw missing top left
			function drawMissingCorner(v0,v1,v2,v3,v4,v5,v6,v7,v8,v9,v10,v11,v12,v13,v14,v15) {
				cc[beginPath]();
				cc["moveTo"](v0,v1);
				cc[lineTo](v2,v3);
				cc[lineTo](v4,v5);
				cc[lineTo](v6,v7);
				cc["arc"](v8,v9,r,v10*Math.PI,v11*Math.PI);
				cc[lineTo](v12,v13);
				cc[lineTo](v14,v15);
				cc[lineTo](v0,v1);
				cc[closePath]();
				cc["fill"]();				
			}
			if (i==7)  drawMissingCorner(p4,p4,p4, 0,p2, 0,p2,p1,p1,p1,  0,0.5, 0,p2, 0,p4);	//draw missing top left
			if (i==11) drawMissingCorner(0 ,p4,p4,p4,p4,p2,p3,p2,p3,p1,0.5,  1,p2, 0, 0, 0);	//draw missing top right
			if (i==13) drawMissingCorner(p4, 0, 0, 0, 0,p2,p1,p2,p1,p3,1.5,  0,p2,p4,p4,p4);	//draw missing bottom left
			if (i==14) drawMissingCorner(0 , 0, 0,p4,p2,p4,p2,p3,p3,p3,1  ,1.5,p4,p2,p4, 0);	//draw missing bottom right
			
			//save corner
			corner[i]=canvasCorner;
		}
		
		return corner;
	}
	function drawLogoBorder(ctx,symbol) {
		if (symbol<2) {
			ctx[beginPath]();
			ctx["fillStyle"]="#0066cc";
			ctx["arc"](0,0,0.891,0,2*Math.PI);
			ctx[closePath]();
			ctx["fill"]();
			ctx[beginPath]();
			ctx["fillStyle"]="#002352";
			ctx["arc"](0,0,0.709,0,2*Math.PI);
			ctx[closePath]();
			ctx["fill"]();
		}
	}
	function logoD(ctx,symbol) {
		ctx["save"]();
		
		var logoDigiByte=function() {
			ctx["fillStyle"]="#FFFFFF";											//set d color to be white
			ctx[beginPath]();
			ctx["moveTo"]( 0.245,-0.361);
			ctx[lineTo]( 0.270,-0.428);
			ctx[bezierCurveTo]( 0.273,-0.435, 0.268,-0.442, 0.261,-0.442);
			ctx[lineTo]( 0.166,-0.442);
			ctx[lineTo]( 0.136,-0.363);
			ctx[lineTo]( 0.094,-0.363);
			ctx[lineTo]( 0.118,-0.428);
			ctx[bezierCurveTo]( 0.121,-0.435, 0.116,-0.442, 0.109,-0.442);
			ctx[lineTo]( 0.014,-0.442);
			ctx[lineTo](-0.016,-0.363);
			ctx[lineTo](-0.313,-0.363);
			ctx[bezierCurveTo](-0.327,-0.363,-0.339,-0.356,-0.346,-0.344);
			ctx[lineTo](-0.420,-0.214);
			ctx[lineTo](-0.317,-0.214);
			ctx[lineTo]( 0.134,-0.214);
			ctx[bezierCurveTo]( 0.152,-0.214, 0.170,-0.211, 0.187,-0.204);
			ctx[bezierCurveTo]( 0.221,-0.190, 0.259,-0.160, 0.249,-0.091);
			ctx[bezierCurveTo]( 0.233, 0.024, 0.116, 0.228,-0.139, 0.231);
			ctx[lineTo](-0.007,-0.111);
			ctx[bezierCurveTo](-0.002,-0.125,-0.012,-0.140,-0.028,-0.140);
			ctx[lineTo](-0.204,-0.140);
			ctx[lineTo](-0.417, 0.383);
			ctx[bezierCurveTo](-0.417, 0.383,-0.374, 0.388,-0.307, 0.388);
			ctx[lineTo](-0.329, 0.443);
			ctx[lineTo](-0.231, 0.443);
			ctx[bezierCurveTo](-0.223, 0.443,-0.216, 0.439,-0.213, 0.431);
			ctx[lineTo](-0.195, 0.384);
			ctx[bezierCurveTo](-0.180, 0.383,-0.166, 0.381,-0.151, 0.379);
			ctx[lineTo](-0.175, 0.443);
			ctx[lineTo](-0.078, 0.443);
			ctx[bezierCurveTo](-0.070, 0.443,-0.063, 0.439,-0.061, 0.431);
			ctx[lineTo](-0.033, 0.359);
			ctx[bezierCurveTo]( 0.127, 0.323, 0.298, 0.243, 0.400, 0.076);
			ctx[bezierCurveTo]( 0.606,-0.260, 0.392,-0.346, 0.245,-0.361);
			ctx[closePath]();
			ctx["fill"]();															//fill in d area
		}
		var logoDigiID=function() {
			ctx["miterLimit"]="0";
			ctx["save"]();
			ctx["save"]();
			ctx["globalAlpha"]="0.3";
			ctx["fillStyle"]="#FFFFFF";
			ctx[beginPath]();
			ctx["moveTo"](0.163,0.589);
			ctx[bezierCurveTo](0.161,0.589,0.158,0.589,0.156,0.588);
			ctx[bezierCurveTo](0.066,0.562,0.008,0.526,-0.053,0.461);
			ctx[bezierCurveTo](-0.132,0.376,-0.175,0.264,-0.175,0.144);
			ctx[bezierCurveTo](-0.175,0.045,-0.098,-0.035,-0.001,-0.035);
			ctx[bezierCurveTo](0.095,-0.035,0.172,0.045,0.172,0.144);
			ctx[bezierCurveTo](0.172,0.209,0.225,0.262,0.289,0.262);
			ctx[bezierCurveTo](0.353,0.262,0.406,0.209,0.406,0.144);
			ctx[bezierCurveTo](0.406,-0.085,0.223,-0.271,-0.002,-0.271);
			ctx[bezierCurveTo](-0.162,-0.271,-0.308,-0.174,-0.374,-0.026);
			ctx[bezierCurveTo](-0.395,0.023,-0.407,0.08,-0.407,0.144);
			ctx[bezierCurveTo](-0.407,0.192,-0.403,0.266,-0.369,0.363);
			ctx[bezierCurveTo](-0.364,0.379,-0.371,0.396,-0.386,0.402);
			ctx[bezierCurveTo](-0.401,0.408,-0.417,0.4,-0.423,0.384);
			ctx[bezierCurveTo](-0.45,0.304,-0.464,0.226,-0.464,0.144);
			ctx[bezierCurveTo](-0.464,0.072,-0.45,0.005,-0.425,-0.052);
			ctx[bezierCurveTo](-0.35,-0.221,-0.184,-0.33,-0.002,-0.33);
			ctx[bezierCurveTo](0.254,-0.33,0.462,-0.117,0.462,0.145);
			ctx[bezierCurveTo](0.462,0.244,0.384,0.324,0.289,0.324);
			ctx[bezierCurveTo](0.193,0.324,0.115,0.244,0.115,0.145);
			ctx[bezierCurveTo](0.115,0.081,0.062,0.028,-0.002,0.028);
			ctx[bezierCurveTo](-0.066,0.028,-0.119,0.081,-0.119,0.145);
			ctx[bezierCurveTo](-0.119,0.249,-0.081,0.346,-0.014,0.419);
			ctx[bezierCurveTo](0.04,0.476,0.091,0.507,0.171,0.53);
			ctx[bezierCurveTo](0.186,0.535,0.194,0.551,0.191,0.568);
			ctx[bezierCurveTo](0.187,0.58,0.176,0.589,0.163,0.589);
			ctx[lineTo](0.163,0.589);
			ctx[lineTo](0.163,0.589);
			ctx[closePath]();
			ctx["moveTo"](0.277,0.464);
			ctx[bezierCurveTo](0.21,0.464,0.151,0.445,0.102,0.41);
			ctx[bezierCurveTo](0.018,0.349,-0.031,0.249,-0.031,0.144);
			ctx[bezierCurveTo](-0.031,0.127,-0.018,0.114,-0.003,0.114);
			ctx[bezierCurveTo](0.012,0.114,0.025,0.128,0.025,0.144);
			ctx[bezierCurveTo](0.025,0.229,0.065,0.31,0.133,0.36);
			ctx[bezierCurveTo](0.173,0.389,0.22,0.404,0.277,0.404);
			ctx[bezierCurveTo](0.291,0.404,0.313,0.402,0.336,0.398);
			ctx[bezierCurveTo](0.351,0.395,0.365,0.406,0.368,0.422);
			ctx[bezierCurveTo](0.371,0.438,0.361,0.454,0.346,0.457);
			ctx[bezierCurveTo](0.312,0.464,0.285,0.464,0.277,0.464);
			ctx[lineTo](0.277,0.464);
			ctx[lineTo](0.277,0.464);
			ctx[closePath]();
			ctx["moveTo"](-0.126,0.577);
			ctx[bezierCurveTo](-0.134,0.577,-0.141,0.574,-0.147,0.568);
			ctx[bezierCurveTo](-0.195,0.514,-0.222,0.481,-0.26,0.408);
			ctx[bezierCurveTo](-0.299,0.333,-0.32,0.242,-0.32,0.144);
			ctx[bezierCurveTo](-0.32,-0.037,-0.176,-0.183,-0.001,-0.183);
			ctx[bezierCurveTo](0.174,-0.183,0.318,-0.037,0.318,0.144);
			ctx[bezierCurveTo](0.318,0.161,0.305,0.174,0.29,0.174);
			ctx[bezierCurveTo](0.275,0.174,0.262,0.16,0.262,0.144);
			ctx[bezierCurveTo](0.262,-0.003,0.144,-0.123,-0.001,-0.123);
			ctx[bezierCurveTo](-0.146,-0.123,-0.264,-0.004,-0.264,0.144);
			ctx[bezierCurveTo](-0.264,0.231,-0.246,0.312,-0.212,0.377);
			ctx[bezierCurveTo](-0.176,0.447,-0.151,0.478,-0.108,0.524);
			ctx[bezierCurveTo](-0.097,0.536,-0.097,0.555,-0.109,0.567);
			ctx[bezierCurveTo](-0.112,0.574,-0.119,0.577,-0.126,0.577);
			ctx[lineTo](-0.126,0.577);
			ctx[lineTo](-0.126,0.577);
			ctx[closePath]();
			ctx["moveTo"](-0.479,-0.156);
			ctx[bezierCurveTo](-0.485,-0.156,-0.491,-0.158,-0.496,-0.161);
			ctx[bezierCurveTo](-0.509,-0.171,-0.512,-0.19,-0.503,-0.204);
			ctx[bezierCurveTo](-0.447,-0.289,-0.376,-0.355,-0.291,-0.402);
			ctx[bezierCurveTo](-0.114,-0.501,0.112,-0.502,0.289,-0.403);
			ctx[bezierCurveTo](0.374,-0.356,0.444,-0.29,0.501,-0.206);
			ctx[bezierCurveTo](0.511,-0.192,0.508,-0.173,0.495,-0.164);
			ctx[bezierCurveTo](0.482,-0.155,0.465,-0.157,0.456,-0.171);
			ctx[bezierCurveTo](0.405,-0.247,0.341,-0.307,0.264,-0.349);
			ctx[bezierCurveTo](0.103,-0.438,-0.104,-0.438,-0.265,-0.348);
			ctx[bezierCurveTo](-0.341,-0.305,-0.406,-0.245,-0.455,-0.168);
			ctx[bezierCurveTo](-0.461,-0.16,-0.47,-0.156,-0.479,-0.156);
			ctx[lineTo](-0.479,-0.156);
			ctx[lineTo](-0.479,-0.156);
			ctx[closePath]();
			ctx["moveTo"](0.327,-0.474);
			ctx[bezierCurveTo](0.322,-0.474,0.318,-0.475,0.314,-0.478);
			ctx[bezierCurveTo](0.206,-0.538,0.112,-0.564,0.001,-0.564);
			ctx[bezierCurveTo](-0.111,-0.564,-0.217,-0.535,-0.313,-0.478);
			ctx[bezierCurveTo](-0.327,-0.47,-0.343,-0.475,-0.351,-0.49);
			ctx[bezierCurveTo](-0.358,-0.506,-0.353,-0.523,-0.339,-0.532);
			ctx[bezierCurveTo](-0.235,-0.594,-0.119,-0.625,0.002,-0.625);
			ctx[bezierCurveTo](0.121,-0.625,0.227,-0.596,0.341,-0.532);
			ctx[bezierCurveTo](0.355,-0.524,0.361,-0.506,0.354,-0.491);
			ctx[bezierCurveTo](0.346,-0.48,0.337,-0.474,0.327,-0.474);
			ctx[lineTo](0.327,-0.474);
			ctx[lineTo](0.327,-0.474);
			ctx[closePath]();
			ctx["fill"]();
			ctx["restore"]();
			ctx["save"]();
			ctx["fillStyle"]="#FFFFFF";
			ctx[beginPath]();
			ctx["moveTo"](-0.34,-0.532);
			ctx[bezierCurveTo](-0.354,-0.523,-0.359,-0.506,-0.352,-0.49);
			ctx[bezierCurveTo](-0.344,-0.475,-0.328,-0.47,-0.314,-0.478);
			ctx[bezierCurveTo](-0.217,-0.535,-0.112,-0.564,-0.001,-0.564);
			ctx[lineTo](-0.001,-0.625);
			ctx[bezierCurveTo](-0.121,-0.625,-0.236,-0.593,-0.34,-0.532);
			ctx[closePath]();
			ctx["fill"]();
			ctx[beginPath]();
			ctx["moveTo"](-0.29,-0.402);
			ctx[bezierCurveTo](-0.375,-0.355,-0.446,-0.289,-0.502,-0.204);
			ctx[bezierCurveTo](-0.511,-0.19,-0.508,-0.172,-0.495,-0.162);
			ctx[bezierCurveTo](-0.49,-0.158,-0.484,-0.156,-0.478,-0.156);
			ctx[bezierCurveTo](-0.469,-0.156,-0.46,-0.16,-0.456,-0.169);
			ctx[bezierCurveTo](-0.405,-0.246,-0.341,-0.307,-0.265,-0.349);
			ctx[bezierCurveTo](-0.184,-0.394,-0.092,-0.416,0,-0.416);
			ctx[lineTo](0,-0.477);
			ctx[bezierCurveTo](-0.101,-0.476,-0.202,-0.452,-0.29,-0.402);
			ctx[closePath]();
			ctx["fill"]();
			ctx[beginPath]();
			ctx["moveTo"](0,-0.183);
			ctx[bezierCurveTo](-0.176,-0.183,-0.319,-0.037,-0.319,0.144);
			ctx[bezierCurveTo](-0.319,0.242,-0.298,0.332,-0.259,0.408);
			ctx[bezierCurveTo](-0.222,0.481,-0.195,0.514,-0.147,0.567);
			ctx[bezierCurveTo](-0.141,0.574,-0.134,0.577,-0.126,0.577);
			ctx[bezierCurveTo](-0.119,0.577,-0.112,0.574,-0.107,0.567);
			ctx[bezierCurveTo](-0.095,0.556,-0.095,0.537,-0.106,0.525);
			ctx[bezierCurveTo](-0.15,0.477,-0.174,0.448,-0.21,0.378);
			ctx[bezierCurveTo](-0.245,0.312,-0.263,0.231,-0.263,0.144);
			ctx[bezierCurveTo](-0.263,-0.003,-0.145,-0.123,0,-0.123);
			ctx[lineTo](0,-0.123);
			ctx[lineTo](0,-0.183);
			ctx[lineTo](0,-0.183);
			ctx[closePath]();
			ctx["fill"]();
			ctx[beginPath]();
			ctx["moveTo"](-0.002,-0.332);
			ctx[bezierCurveTo](-0.184,-0.332,-0.35,-0.222,-0.425,-0.053);
			ctx[bezierCurveTo](-0.45,0.005,-0.464,0.071,-0.464,0.144);
			ctx[bezierCurveTo](-0.464,0.226,-0.45,0.304,-0.423,0.384);
			ctx[bezierCurveTo](-0.417,0.4,-0.401,0.407,-0.386,0.402);
			ctx[bezierCurveTo](-0.371,0.397,-0.365,0.379,-0.369,0.363);
			ctx[bezierCurveTo](-0.404,0.266,-0.407,0.191,-0.407,0.144);
			ctx[bezierCurveTo](-0.407,0.081,-0.395,0.023,-0.374,-0.026);
			ctx[bezierCurveTo](-0.308,-0.175,-0.162,-0.271,-0.002,-0.271);
			ctx[bezierCurveTo](-0.001,-0.271,-0.001,-0.271,0,-0.271);
			ctx[lineTo](0,-0.332);
			ctx[bezierCurveTo](-0.001,-0.332,-0.001,-0.332,-0.002,-0.332);
			ctx[closePath]();
			ctx["fill"]();
			ctx[beginPath]();
			ctx["moveTo"](-0.031,0.144);
			ctx[bezierCurveTo](-0.031,0.194,-0.02,0.242,0,0.286);
			ctx[lineTo](0,0.114);
			ctx[bezierCurveTo](-0.001,0.114,-0.002,0.114,-0.003,0.114);
			ctx[bezierCurveTo](-0.019,0.114,-0.031,0.127,-0.031,0.144);
			ctx[closePath]();
			ctx["fill"]();
			ctx[beginPath]();
			ctx["moveTo"](-0.014,0.418);
			ctx[bezierCurveTo](-0.081,0.345,-0.119,0.247,-0.119,0.144);
			ctx[bezierCurveTo](-0.119,0.079,-0.066,0.026,-0.002,0.026);
			ctx[bezierCurveTo](-0.001,0.026,-0.001,0.026,0,0.026);
			ctx[lineTo](0,-0.035);
			ctx[lineTo](-0.001,-0.035);
			ctx[bezierCurveTo](-0.098,-0.035,-0.175,0.045,-0.175,0.144);
			ctx[bezierCurveTo](-0.175,0.264,-0.132,0.376,-0.053,0.46);
			ctx[bezierCurveTo](-0.035,0.48,-0.018,0.495,0,0.51);
			ctx[lineTo](0,0.432);
			ctx[bezierCurveTo](-0.005,0.427,-0.009,0.423,-0.014,0.418);
			ctx[closePath]();
			ctx["fill"]();
			ctx["restore"]();
			ctx["restore"]();
			ctx["save"]();
			ctx["fillStyle"]="#FFFFFF";
			ctx[beginPath]();
			ctx["moveTo"](0.004,0.701);
			ctx[bezierCurveTo](0.004,0.704,0.002,0.706,-0.001,0.706);
			ctx[lineTo](-0.001,0.706);
			ctx[bezierCurveTo](-0.003,0.706,-0.006,0.704,-0.006,0.701);
			ctx[lineTo](-0.006,-0.734);
			ctx[bezierCurveTo](-0.006,-0.737,-0.003,-0.739,-0.001,-0.739);
			ctx[lineTo](-0.001,-0.739);
			ctx[bezierCurveTo](0.002,-0.739,0.004,-0.737,0.004,-0.734);
			ctx[lineTo](0.004,0.701);
			ctx[closePath]();
			ctx["fill"]();
			ctx["restore"]();
		}
		var logoAntum=function() {
			ctx["translate"](-0.88,-0.8);
			ctx["scale"](0.07,0.07);
			ctx["save"]();
			ctx["strokeStyle"]="rgba(0,0,0,0)";
			ctx["miterLimit"]=4;
			ctx["scale"](0.465,0.465);
			ctx["translate"](0.222,0);
			ctx["scale"](0.463,0.463);
			ctx["save"]();
			var g = ctx["createLinearGradient"](165.69,271.09,165.69,205.77);
			g["addColorStop"](0,"#dfddda");
			g["addColorStop"](1,"#b7ced7");
			
			var getCTX=function(x,g) {
				var canvas = document["createElement"]("canvas");
				canvas["width"] = 1263;
				canvas["height"] = 689;				
				var ctx1 = canvas["getContext"]("2d");								
				ctx1["fillStyle"]=g;
				ctx1["save"]();
				ctx1["strokeStyle"]="rgba(0,0,0,0)";
				ctx1["miterLimit"]=4;
				ctx1[beginPath]();
				ctx1["moveTo"](0,0);
				ctx1[lineTo](1263,0);
				ctx1[lineTo](1263,689);
				ctx1[lineTo](0,689);
				ctx1[closePath]();
				ctx1["clip"]();
				ctx1["save"]();
				switch (x) {
					case 1:
					ctx1["translate"](3.33,-5.24);
					ctx1["rotate"](0.0113);
					break;
					
					case 2:
					ctx1["transform"](-1,-0.05,-0.05,1,1403.03,43.69);
					break;
					
					case 3:
					ctx1["translate"](-361.39,43.69);
					ctx1["rotate"](-0.0482);
			
				}
				ctx1["save"]();
				ctx1[beginPath]();
				ctx1["moveTo"](-10000,-10000);
				ctx1[lineTo](20000,-10000);
				ctx1["quadraticCurveTo"](20000,-10000,20000,-10000);
				ctx1[lineTo](20000,20000);
				ctx1["quadraticCurveTo"](20000,20000,20000,20000);
				ctx1[lineTo](-10000,20000);
				ctx1["quadraticCurveTo"](-10000,20000,-10000,20000);
				ctx1[lineTo](-10000,-10000);
				ctx1["quadraticCurveTo"](-10000,-10000,-10000,-10000);
				ctx1[closePath]();
				ctx1["fill"]();
				ctx1["stroke"]();
				ctx1["restore"]();
				ctx1["restore"]();
				ctx1["restore"]();
				return ctx1;
			}
			
			var ctx1=getCTX(1,g);
			var p = ctx1["createPattern"](ctx1.canvas,"no-repeat");
			ctx["fillStyle"]=p;
			ctx["translate"](-108.36,-202.39);
			ctx[beginPath]();
			ctx["moveTo"](167.06,202.39);
			ctx[lineTo](166.84,202.79);
			ctx[bezierCurveTo](165.84,216.38,144.22,257.92,144.22,257.92);
			ctx[lineTo](143.67,257.92);
			ctx[lineTo](156.14,267.58);
			ctx["translate"](166.24,270.338);
			ctx["arc"](0,0,10.47,-2.875,-1.592,0);
			ctx["translate"](-166.24,-270.338);
			ctx["translate"](165.627,270.233);
			ctx["arc"](0,0,10.37,-1.533,-0.32,0);
			ctx["translate"](-165.627,-270.233);
			ctx[lineTo](188.2,258.42);
			ctx[lineTo](188.42,258.01);
			ctx[bezierCurveTo](188.42,258.01,167.79,216,167.06,202.39);
			ctx[closePath]();
			ctx["fill"]();
			ctx["stroke"]();
			ctx["restore"]();
			ctx["save"]();
			var g = ctx["createLinearGradient"](1184.86,332,1213.41,282.55);
			g["addColorStop"](0,"#0098d5");
			g["addColorStop"](1,"#164c8e");
			var ctx2 = getCTX(2,g);
			var p = ctx2["createPattern"](ctx2.canvas,"no-repeat");
			ctx["fillStyle"]=p;
			ctx["translate"](-108.36,-202.39);
			ctx[beginPath]();
			ctx["moveTo"](223,308.18);
			ctx[lineTo](222.61,308.18);
			ctx[bezierCurveTo](217.61,305.62,206.78,302.68,196.1,301.12);
			ctx["translate"](160.783,539.68);
			ctx["arc"](0,0,241.16,-1.423,-1.537,1);
			ctx["translate"](-160.783,-539.68);
			ctx[lineTo](169.59,280.41);
			ctx[bezierCurveTo](165.01,268.47,169.59,280.41,171.37,276);
			ctx[bezierCurveTo](173.03,271.86,174.25,277.36,171.75,274);
			ctx[lineTo](189.15,261.44);
			ctx[lineTo](189.55,261.44);
			ctx[bezierCurveTo](189.55,261.44,213,301.05,223,308.18);
			ctx[closePath]();
			ctx["fill"]();
			ctx["stroke"]();
			ctx["restore"]();
			ctx["save"]();
			var g = ctx["createLinearGradient"](26442.139,14187.645,28023.673,11874.869);
			g["addColorStop"](0,"#0098d5");
			g["addColorStop"](1,"#164c8e");
			var ctx3 = getCTX(3,g);
			var p = ctx3["createPattern"](ctx3.canvas,"no-repeat");
			ctx["fillStyle"]=p;
			ctx["translate"](-108.36,-202.39);
			ctx[beginPath]();
			ctx["moveTo"](108.36,308.18);
			ctx[lineTo](108.75,308.18);
			ctx[bezierCurveTo](113.75,305.62,124.58,302.68,135.26,301.12);
			ctx["translate"](170.837,539.641);
			//ctx.rotate(0);
			ctx["arc"](0,0,241.16,-1.719,-1.606,0);
			//ctx.rotate(0);
			ctx["translate"](-170.837,-539.641);
			ctx[lineTo](161.78,280.38);
			ctx[bezierCurveTo](166.36,268.44,161.78,280.38,160,275.97);
			ctx[bezierCurveTo](158.34,271.83,157.12,277.33,159.62,273.97);
			ctx[lineTo](142.22,261.41);
			ctx[lineTo](141.82,261.41);
			ctx[bezierCurveTo](141.82,261.41,118.33,301.05,108.36,308.18);
			ctx[closePath]();
			ctx["fill"]();
			ctx["stroke"]();
			ctx["restore"]();
			ctx["save"]();
			ctx["fillStyle"]="#fff";
			ctx["translate"](-108.36,-202.39);
			ctx[beginPath]();
			ctx["moveTo"](178.91,271.58);
			ctx[bezierCurveTo](178.91,278.88,173.27,284.79,166.31,284.79);
			ctx[bezierCurveTo](159.35,284.79,153.71,278.88,153.71,271.58);
			ctx[bezierCurveTo](153.71,264.28,159.35,258.37,166.31,258.37);
			ctx[bezierCurveTo](173.27,258.37,178.91,264.29,178.91,271.58);
			ctx[closePath]();
			ctx["fill"]();
			ctx["stroke"]();
			ctx["restore"]();
			ctx["save"]();
			ctx["fillStyle"]="#fff";
			ctx[beginPath]();
			ctx["moveTo"](33.86,59.01);
			ctx[lineTo](35.32,55.53);
			ctx[lineTo](46.33,64.07);
			ctx[lineTo](45.47,67.39);
			ctx["fill"]();
			ctx["stroke"]();
			ctx["restore"]();
			ctx["save"]();
			ctx["fillStyle"]="#fff";
			ctx[beginPath]();
			ctx["moveTo"](81.18,58.99);
			ctx[lineTo](80.07,55.63);
			ctx[lineTo](69.18,63.2);
			ctx[lineTo](70.3,66.58);
			ctx["fill"]();
			ctx["stroke"]();
			ctx["restore"]();
			ctx["save"]();
			ctx["fillStyle"]="#fff";
			ctx[beginPath]();
			ctx["moveTo"](52.96,80.53);
			ctx[lineTo](61.14,80.53);
			ctx[lineTo](60.63,96.28);
			ctx[lineTo](54.02,96.28);
			ctx[lineTo](52.96,80.53);
			ctx[lineTo](52.96,80.53);
			ctx[closePath]();
			ctx["fill"]();
			ctx["stroke"]();
			ctx["restore"]();
			ctx["restore"]();
		}
		
		
		
		
		
		
		
		switch (symbol) {
			
			//DigiByte
			case 0:
			logoDigiByte();
			break;
			
			//Digi ID
			case 1:
			logoDigiID();
			break;
			
			//Antum ID
			case 2:
			logoAntum();
			break;
			
			//Open ANtum ID
			case 3:
			logoAntum();
			ctx["restore"]();
			ctx["save"]();
			ctx["translate"](0,0.24);
			ctx["scale"](0.1,0.1);
			drawLogoBorder(ctx,0);
			logoDigiByte();
			//ctx["restore"]();
			
		}		
		ctx["restore"]();
	}
	
	
	
	function getQRCode(obj) {
		var text=obj["data"],
			qrCodeSize=obj["size"]||200,
			addLogo=obj["logo"]||0,
			radius=obj["r"]||0,
			symbol=obj["symbol"]||0;
			
		//figure out alphabet to use
		var alphabet="Byte";
		if (text==text["replace"](/[^0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ \$\%\*\+\-\.\/\:]/g,"")) {
			alphabet="Alphanumeric";
		}
		
		//prep canvas for qr code
		var canvas=document["createElement"]("canvas");						//create a canvas to work with
		canvas["height"]=canvas["width"]=qrCodeSize;						//set canvas dimensions default 200px
		var ctx=canvas["getContext"]("2d");									//get canvas context

		//create qr code
		var qr = qrcode(
			0,																//make qr code as small as possible
			(addLogo>0)?"H":"L"													//set error correction to 30% if adding logo otherwise 7%
		);
		qr["addData"](text,alphabet);			
		qr["make"]();															//calculate qr code
		var count=qr["getModuleCount"]();										//get qr code module count
		var pixelSize=Math["floor"](qrCodeSize/count);							//get max size of module that fits
		var margin=Math["floor"]((qrCodeSize-count*pixelSize)/2);				//compute size of margin required to center
		
		//draw qr code
		ctx["save"]();															//save so we can restore back to normal
		ctx["translate"](margin,margin);										//shift perspective so edge of qrcode is at 0
		ctx["fillStyle"]="#000000";
		ctx["fillRect"](0,0,count*pixelSize,count*pixelSize);
		
		//calculate logo size
		var center=pixelSize*count/2;
		var logoSize=pixelSize;
		if (addLogo<5) {
			logoSize*=Math["min"](Math["floor"]((Math["sqrt"](0.2*count*count)+1)/2)-0.5,(count-16)*0.5);	//cover up to 20% of logo but make sure not covering eyes
		} else if(addLogo<7) {
			logoSize*=(count-1)*0.4;												//logo mostly translucent so rules are simpler
		} else {
			logoSize*=Math["min"](1.12*Math["sqrt"](count*count*0.5)-11.08,count*0.56);	//make logo as big as possible to not touch eyes
		}		
		
		//draw corners
		function drawGrid(color) {
			var corners=createCorners(pixelSize,Math.abs(radius),color);			//draw non dark areas in white
			var rsMax=logoSize/pixelSize;								//get number of modules logo is across
			rsMax*=rsMax;												//get square of radius
		
			function numFilter(x,y) {
				if ((x<0)||(x>=count)||(y<0)||(y>=count)) return 1;
				if (addLogo==3) {
					var cc=(count-1)/2;													//count center
					var dx=(x-cc);													//distance from center x
					var dy=(y-cc);													//distance from center y
					if (dx*dx+dy*dy<=rsMax) return 1;								//if within radius squared calculated earlier then set as color
				}
				return (!qr["isDark"](x,y));
			}
			for (var y=-1;y<=count;y++) {											//go over each row
				for (var x=-1;x<=count;x++) {										//go over each column
					var i=numFilter(x,y)*8+numFilter(x+1,y)*4+numFilter(x,y+1)*2+numFilter(x+1,y+1);	//get corner type
					if (radius<0) { //draw only eyes
						if ((x>6) && (y>6)) i=15;
						if ((x>6) && (x<count-8)) i=15;
						if ((y>6) && (y<count-8)) i=15;
					}					
					ctx["drawImage"](corners[i],(x+0.5)*pixelSize,(y+0.5)*pixelSize);	//draw the corner on canvas
				}
			}		
		}
		drawGrid("#FFFFFF");												//draw grid with white light areas
		
		//add logo
		ctx["save"]();
		ctx["transform"](logoSize,0,0,logoSize,center,center);
		ctx["save"]();
		if (addLogo==1) {													//logo 1 make white box
			ctx[beginPath]();
			ctx["fillStyle"]="#FFFFFF";
			ctx["rect"](-1,-1,2,2);
			ctx[closePath]();
			ctx["fill"]();
		}
		if (addLogo==2) {													//logo 2 white circle
			ctx[beginPath]();
			ctx["fillStyle"]="#FFFFFF";
			ctx["arc"](0,0,1,0,2*Math.PI);
			ctx[closePath]();
			ctx["fill"]();
		}
		if (addLogo>0) {
			drawLogoBorder(ctx,symbol);												//draw the outer boarder
			logoD(ctx,symbol);															//define d area	
		}
		ctx["restore"]();
		ctx["restore"]();
		
		
		//draw dots
		if ((addLogo==5)||(addLogo==7)||(radius<0)) {														
			ctx["save"]();
			ctx["transform"](pixelSize,0,0,pixelSize,pixelSize/2,pixelSize/2);		//adjust size to make drawing dots easy
			ctx["save"]();
			for (var y=0;y<count;y++) {											//go over each row
				for (var x=0;x<count;x++) {										//go over each column
					function drawDot(size,color) {
						ctx["fillStyle"]=color;
						ctx[beginPath]();
						ctx["arc"](x,y,size,0,2*Math.PI);						//define dot
						ctx[closePath]();
						ctx["fill"]();	
					}
					if ((addLogo==5)&&(!qr["isDark"](x,y))) drawDot(0.5,"rgba(255,255,255,0.5)");	//make translucent white dots
					if (addLogo==7) drawDot(0.2,(qr["isDark"](x,y))?"#000000":"#FFFFFF");			//make small dot for both colors
					if (radius<0) drawDot(0.4,(qr["isDark"](x,y))?"#000000":"#FFFFFF");
				}
			}
			ctx["restore"]();
			ctx["restore"]();
		}	
		if (addLogo==6) {
			drawGrid("rgba(255,255,255,0.5)");
		}
		
		ctx["restore"]();														//restore so image is centered
		return canvas["toDataURL"]("image/jpg");								//convert canvas into a jpg
	}
	
	
	var ucBech32=function(address) {
		var start=address["indexOf"](":")+1;										//find start of address if there is an address
		if ((address["substr"](start,4)=="dgb1")&&(address["indexOf"]("?")==-1)) {	//see if address is bech32 address
			address=address["toUpperCase"]();										//if bech 32 address then make upper case
		}
		return address;
	}
	var noProcess=function(data,size,logo,radius,symbol) {							//text interface(Same as address but added because some times calling this makes more sense)
		return getQRCode({
			"data":	ucBech32(data),
			"size":	size,
			"logo":	logo,
			"r":	radius,
			"symbol":symbol
		});
	}
	
	//auto load
	var autoLoad=function() {
		var domCheck=document["getElementsByClassName"]("DigiQR");
		for (var i=0; i<domCheck["length"]; i++) {										//go through each of the class far dom items and get its index in array
			var data=domCheck[i]["getAttribute"]("uri");
			var size=parseInt(domCheck[i]["getAttribute"]("size")||300);
			var logo=parseInt(domCheck[i]["getAttribute"]("logo")||6);
			var r=parseFloat(domCheck[i]["getAttribute"]("r")||0.5);
			var symbol=(data["toLowerCase"]()["substr"](0,9)=="digiid://")?1:0;
			domCheck[i]["src"]=noProcess(data,size,logo,r,symbol);
		}
	}
	autoLoad();
	
	
	//DigiQR
	window["DigiQR"]={																//create interface for external scripts
		"request": function(address,amount,size,logo,radius) {					//request payment interface
			return noProcess("digibyte:"+address+((amount==0)?0:"?amount="+(amount)["toFixed"](8)),size,logo,radius); 
		},
		"address": noProcess,													//general address interface
		"explorer": function(address,size,logo,radius) {						//explorer interface
			return noProcess("https://digiexplorer.info/address/"+address,size,logo,radius);
		},
		"text": noProcess,														//text interface(Same as address but added because some times calling this makes more sense)
		"gen": getQRCode,
		"id": function(uri,size,logo,radius) {
			return noProcess(uri,size,logo,radius,1);
		},
		"antum": function(uri,size,logo,radius) {
			return noProcess(uri,size,logo,radius,2);
		},
		"openantum": function(uri,size,logo,radius) {
			return noProcess(uri,size,logo,radius,3);
		},
		"auto": autoLoad
	};})(document);