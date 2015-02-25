var Mat = function( imageData ) {
	
	if (imageData == undefined) return;

	if ( imageData.constructor == ImageData ) {
		this.rows    = imageData.height;
		this.cols    = imageData.width;
		this.channel = imageData.data.length / (this.rows * this.cols);
		this.data    = [];
		for (var i = 0; i < imageData.data.length; ++i) {
			this.data[i] = imageData.data[i];
		}
	}
	
	if ( imageData.constructor == Mat ) {
		this.rows    = imageData.rows;
		this.cols    = imageData.cols;
		this.channel = imageData.channel;
		this.data    = [];
		for (var i = 0; i < imageData.data.length; ++i) {
			this.data[i] = imageData.data[i];
		}
	}
	
}

Mat.prototype.getIdx = function(row, col) {
	return ( row * this.cols + col ) * this.channel;
}

Mat.prototype.at = function(idx) {
	return this.data[idx];
}

Mat.prototype.get = function(row, col) {
	var arr = [];
	var idx = this.getIdx(row, col);
	for (var i = 0; i < this.channel; ++i) {
		arr[i] = this.data[idx+i];
	}
	return arr;
}

Mat.prototype.set = function(row, col, arr) {
	var idx = this.getIdx(row, col);
	var ch = Math.min(arr.length, this.channel);
	for (var i = 0; i < ch; ++i) {
		this.data[idx+i] = arr[i];
	}
}

Mat.prototype.getMinMax = function() {
	// find min , max value
	var minV =  999999999.0;
	var maxV = -999999999.0;
	for (var i = 0; i < this.data.length; ++i) {
		var tmp = this.data[i];
		if (tmp < minV) {
			minV = tmp;
		} 
		if (tmp > maxV) {
			maxV = tmp;
		}
	}
	
	return [minV, maxV];
}

Mat.prototype.normalize = function(min, max) {
	// find min , max value
	var meanMat = new Mat( this );
	meanMat.data.sort();
	var minV = meanMat.data[ Math.ceil( meanMat.total() * 0.0001 ) ];
	var maxV = meanMat.data[ Math.ceil( meanMat.total() * 0.9999 ) ];
	
	var interV = maxV - minV;
	var inter  = max - min;
	for (var i = 0; i < this.data.length; ++i) { 
		this.data[i] = ( (this.data[i] - minV) / interV) * inter + min;
	}
	
}

Mat.prototype.rgb2gray = function() {
	var mat = createMat(this.rows, this.cols, 1);
	var j = 0;
	for (var i = 0; i < this.data.length; i += this.channel) {
		var r = this.data[i+0];
		var g = this.data[i+1];
		var b = this.data[i+2];
		mat.data[j] = r*0.2126 + g*0.7152 + b*0.0722;
		j++;
	}
	return mat;
}

Mat.prototype.toImageData = function( imageData ) {
	imageData.width  = this.cols;
	imageData.height = this.rows;
	if (this.channel == 1) {
		var j = 0;
		for (var i = 0; i < imageData.data.length; i+=4) {
			imageData.data[i+0] = this.data[j];
			imageData.data[i+1] = this.data[j];
			imageData.data[i+2] = this.data[j];
			imageData.data[i+3] = 255;
			j++;
		}
	} else {
		for (var i = 0; i < imageData.data.length; i++) {
			imageData.data[i] = this.data[i];
		}
	}
	return imageData;
}

Mat.prototype.add = function( mat ) {
	var result = createMat(this.rows, this.cols, this.channel);
	for (var i = 0; i < this.data.length; ++i) {
		if ( mat.constructor == Mat ) {
			result.data[i] = this.data[i] + mat.data[i];
		} else {
			result.data[i] = this.data[i] + mat;
		}
	}
	
	return result;
}

Mat.prototype.sub = function( mat ) {
	var result = createMat(this.rows, this.cols, this.channel);
	for (var i = 0; i < this.data.length; ++i) {
		if ( mat.constructor == Mat ) {
			result.data[i] = this.data[i] - mat.data[i];
		} else {
			result.data[i] = this.data[i] - mat;
		}
	}
	
	return result;
}

Mat.prototype.mul = function( mat ) {
	var result = createMat(this.rows, this.cols, this.channel);
	for (var i = 0; i < this.data.length; ++i) {
		if ( mat.constructor == Mat ) {
			result.data[i] = this.data[i] * mat.data[i];
		} else {
			result.data[i] = this.data[i] * mat;
		}
	}
	
	return result;
}

Mat.prototype.abs = function() {
	var result = createMat(this.rows, this.cols, this.channel);
	for (var i = 0; i < this.data.length; ++i) {
		result.data[i] = Math.abs( this.data[i] );
	}
	
	return result;
}

Mat.prototype.sign = function() {
	var result = createMat(this.rows, this.cols, this.channel);
	for (var i = 0; i < this.data.length; ++i) {
		if ( this.data[i] >= 0 ) {
			result.data[i] = 1;
		} else {
			result.data[i] = -1;
		}
	}
	
	return result;
}

Mat.prototype.total = function() {
	return this.data.length;
}

function createMat(rows, cols, channel) {
	var mat = new Mat();
	mat.channel = channel;
	mat.rows = rows;
	mat.cols = cols;
	mat.data = new Array( rows*cols*channel );
	for (var i = 0; i < mat.data.length; ++i) {
		mat.data[i] = 0.0;
	}
	return mat;
}

function clamp(value, min, max) {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

// for 1-channel image filtering
function filter2Dc1(matIn, matOut, kernel) {
	// image parameters
	var width   = matIn.cols;
	var height  = matIn.rows; 
	
	var width2  = (width - 1) << 1;
	var height2 = (height - 1) << 1;
	
	// kernel padding
	var ksizeY  = kernel.rows >> 1;
	var ksizeX  = kernel.cols >> 1;

	var idx = 0;
	for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			var sum  = 0.0;
			var kIdx = 0;
			
			for (var yy = y - ksizeY; yy <= y + ksizeY; yy++) {
				for (var xx = x - ksizeX; xx <= x + ksizeX; xx++) {
					// border condition (mirror)
					var xxC = xx;
					var yyC = yy;
					if (xxC >= width) { 
						xxC = width2 - xxC; 
					} else if (xxC < 0) {
						xxC = -xxC;
					}
					if (yyC >= height) { 
						yyC = height2 - yyC; 
					} else if (yyC < 0) { 
						yyC = -yyC;
					}
					
					sum += matIn.data[yyC * width + xxC] * kernel.data[kIdx++];
				}
			}
			
			matOut.data[idx++] = sum;
		}
	} // end of outer for
	
	return matOut;
}

// for multi-channel filtering
function filter2D(matIn, matOut, kernel) {
	// image parameters
	var width   = matIn.cols;
	var height  = matIn.rows; 
	var channel = matIn.channel;
	
	var width2  = (width - 1) << 1;
	var height2 = (height - 1) << 1;
	
	// kernel padding
	var ksizeY  = kernel.rows >> 1;
	var ksizeX  = kernel.cols >> 1;

	var idx = 0;
	for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			var sum = [0.0, 0.0, 0.0, 0.0];
			var kIdx = 0;
			
			for (var yy = y - ksizeY; yy <= y + ksizeY; yy++) {
				for (var xx = x - ksizeX; xx <= x + ksizeX; xx++) {
					// border condition (mirror)
					var xxC = xx;
					var yyC = yy;
					if (xxC >= width) { 
						xxC = width2 - xxC; 
					} else if (xxC < 0) {
						xxC = -xxC;
					}
					if (yyC >= height) { 
						yyC = height2 - yyC; 
					} else if (yyC < 0) { 
						yyC = -yyC;
					}
					
					var pixIdx = channel * (yyC * width + xxC);
					for (var i = 0; i < channel; ++i) {
						sum[i] += matIn.data[pixIdx+i] * kernel.data[kIdx++];
					}
				}
			}
			
			for (var i = 0; i < channel; ++i) {
				matOut.data[idx++] = sum[i];
			}
		}
	} // end of outer for
	
	return matOut;
}