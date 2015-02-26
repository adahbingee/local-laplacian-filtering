// parameters
var alpha  = 0.5;       // s-curve
var beta   = 0.0;       // linear scaler
var sigmaR = 0.9;       // middle gray range
var gamma  = 1.2;       // saturation
var maxPyramidNum = 150; // pyramid number (running slow when set large value) 
var imagepath = 'memorial.png';

// set kernel
var kernelDown = new Mat();
kernelDown.rows    = 5;
kernelDown.cols    = 5;
kernelDown.channel = 1;
kernelDown.data    = [ 1/256,  4/256,  6/256,  4/256, 1/256, 
					   4/256, 16/256, 24/256, 16/256, 4/256,
					   6/256, 24/256, 36/256, 24/256, 6/256,
					   4/256, 16/256, 24/256, 16/256, 4/256,
					   1/256,  4/256,  6/256,  4/256, 1/256];
					
var kernelUp = new Mat();
kernelUp.rows    = 5;
kernelUp.cols    = 5;
kernelUp.channel = 1;
kernelUp.data    = [ 1/64,  4/64,  6/64,  4/64, 1/64, 
					 4/64, 16/64, 24/64, 16/64, 4/64,
					 6/64, 24/64, 36/64, 24/64, 6/64,
					 4/64, 16/64, 24/64, 16/64, 4/64,
					 1/64,  4/64,  6/64,  4/64, 1/64];
				
$( document ).ready(function(){
	// load parameters
	var tmp = location.search.split('maxPyramidNum=')[1];
	if (tmp != null) {
		maxPyramidNum = tmp;
	}
	tmp = location.search.split('imagepath=')[1];
	if (tmp != null) {
		imagepath = tmp;
	}
	alert('SLOW program! \nmaxPyramidNum='+maxPyramidNum);

	// load image
	var img    = new Image();
	img.onload = onImageLoad;
	img.src    = imagepath;
});

function onImageLoad(){
	// get image parameters
	var width  = this.width;
	var height = this.height;
	// max pyramid height
	var maxLevel = Math.floor( Math.log2( Math.min(width, height) ) );
	
	// original canvas
	var ctx = $('#original')[0].getContext('2d');
	ctx.canvas.width  = width;
	ctx.canvas.height = height;
	ctx.drawImage(this, 0, 0);
	var imgData  = ctx.getImageData(0, 0, width, height);
	
	// image 
	var imgRGB  = new Mat( imgData ) ;
	// rgb to gray
	var imgGray = imgRGB.rgb2gray();
	// logarithm
	for (var i = 0; i < imgGray.data.length; ++i) {
		imgGray.data[i] = Math.log( imgGray.data[i] + 1.0 );
	}
	

	// local laplacian pyramid using fast approach (???)
	var means = getMeans(imgGray, maxPyramidNum);
	glRemappingLaplacianPyramids(imgGray, means, maxLevel);
	return;
	var laplacianPyramids = remappingLaplacianPyramids(imgGray, means, maxLevel);
	var result = fastLocalContrast(imgGray, means, laplacianPyramids);
	
	// recovery colors
	var meanMat = new Mat( result );
	meanMat.data.sort();
	var minV = meanMat.data[ Math.ceil( meanMat.total() * 0.0001 ) ];
	var maxV = meanMat.data[ Math.ceil( meanMat.total() * 0.9999 ) ];
	var interV = maxV - minV;
	for (var y = 0; y < imgRGB.rows; ++y) {
		for (var x = 0; x < imgRGB.cols; ++x) {
			var arr = [0.0, 0.0, 0.0];
			for (var ch = 0; ch < 3; ++ch) {
				arr[ch] = (result.get(y, x)[0] - minV);
				arr[ch] += gamma * ( Math.log(imgRGB.get(y, x)[ch] + 1.0) - imgGray.get(y, x)[0] );
				arr[ch] /= interV;
				arr[ch] = Math.exp(arr[ch]);
			}
			
			imgRGB.set(y, x, arr);
		}
	}
	
	// normalize to 0 ~ 255
	meanMat = imgRGB.rgb2gray();
	meanMat.data.sort();
	minV = meanMat.data[ Math.ceil( meanMat.total() * 0.0001 ) ];
	maxV = meanMat.data[ Math.ceil( meanMat.total() * 0.9999 ) ];
	interV = 255 / (maxV - minV);
	
	for (var y = 0; y < imgRGB.rows; ++y) {
		for (var x = 0; x < imgRGB.cols; ++x) {
			var arr = imgRGB.get(y, x);
			for (var ch = 0; ch < 3; ++ch) {
				arr[ch] -= minV;
				arr[ch] *= interV;
			}
			
			imgRGB.set(y, x, arr);
		}
	}
	
	imshow('resultRGB', imgRGB);
}

// downsample image to half size
function downsample(matIn, rows, cols) {
	var blurImg = createMat(matIn.rows, matIn.cols, matIn.channel);
	//filter2D(matIn, blurImg, kernelDown);
	filter2Dc1(matIn, blurImg, kernelDown);
	
	var matOut = createMat(rows, cols, matIn.channel);
	
	var i = 0;
	for (var sy = 0, by = 0; sy < matOut.rows; sy++, by+=2) {
		for (var sx = 0, bx = 0; sx < matOut.cols; sx++, bx+=2) {
			matOut.set(sy, sx, blurImg.get(by, bx));
		}
	} // end of for
	
	return matOut;
}

// upsample image to double size
function upsample(matIn, rows, cols) {
	var matPad = createMat(rows, cols, matIn.channel);
	for (var by = 0, sy = 0; sy < matIn.rows && by < matPad.rows; by+=2, sy++) {
		for (var bx = 0, sx = 0; sx < matIn.cols && bx < matPad.cols; bx+=2, sx++) {
			matPad.set(by, bx, matIn.get(sy, sx));
		}
	}

	var blurImg = createMat(rows, cols, matIn.channel);
	//filter2D(matPad, blurImg, kernelUp);
	filter2Dc1(matPad, blurImg, kernelUp);
	
	return blurImg;
}

// reconstruct image from laplacian pyramid
function reconstructionLaplacianPyramid( laplacianPyramid ) {
	var maxLevel = laplacianPyramid.length;
	var out = laplacianPyramid[maxLevel-1];
	for (var i = maxLevel-1; i >= 1; --i) {
		var upsampleImg = upsample(out, laplacianPyramid[i-1].rows, laplacianPyramid[i-1].cols);
		out = upsampleImg.add(laplacianPyramid[i-1]);
	}
	
	return out;
}

// show image without normalize, note the mat data must be 0~255
function imshow( title, mat ) {
	var canvas = $('<canvas/>', {id:title});
	$('body').append(canvas);
	
	var contex     = $('#'+title)[0].getContext('2d');
	contex.canvas.width  = mat.cols;
	contex.canvas.height = mat.rows;
	var imgData = contex.createImageData(mat.cols, mat.rows);
	mat.toImageData(imgData);
	contex.putImageData(imgData, 0, 0);
}

// show image with auto normalization
function showImage( title, mat ) {
	var tmp = new Mat( mat );
	tmp.normalize(0, 255);
	
	var canvas = $('<canvas/>', {id:title});
	$('body').append(canvas);
	
	var contex     = $('#'+title)[0].getContext('2d');
	contex.canvas.width  = tmp.cols;
	contex.canvas.height = tmp.rows;
	var imgData = contex.createImageData(tmp.cols, tmp.rows);
	tmp.toImageData(imgData);
	contex.putImageData(imgData, 0, 0);
}

// show pyramid images
function showPyramid( prefix, pyramid ) {
	for (var level = 0; level < pyramid.length; ++level) {
		showImage( prefix+level, pyramid[level] );
	}
}

// build laplacian pyrmiad
function buildLaplacianPyramid(imgGray, gaussianPyramid, laplacianPyramid, maxLevel) {
	gaussianPyramid[0] = imgGray;
	for (var level = 1; level < maxLevel; ++level) {
		var levelImg = gaussianPyramid[level-1];
		
		// downsample size
		var rows     = (levelImg.rows+1) >> 1;
		var cols     = (levelImg.cols+1) >> 1;
		
		var downsampleImg = downsample(levelImg, rows, cols);
		var upsampleImg   = upsample(downsampleImg, levelImg.rows, levelImg.cols);
		
		gaussianPyramid[level]    = downsampleImg;
		laplacianPyramid[level-1] = levelImg.sub(upsampleImg);
	}
	laplacianPyramid[maxLevel-1] = gaussianPyramid[maxLevel-1];
}

// enhance image function
function remapLuma(matIn, mean, alpha, beta, sigmaR) {

	var out = createMat( matIn.rows, matIn.cols, matIn.channel );
	for (var i = 0; i < out.total(); ++i) {
		var diff = matIn.at(i) - mean;   // difference
		var magi = Math.abs( diff );     // magnitude
		var sign = (diff >= 0) ? 1 : -1; // sign
		
		if ( magi > sigmaR ) {    // tonemap (linear scalar)
			out.data[i] = mean + sign * ( (magi - sigmaR) * beta + sigmaR );
		} else {                  // detail enhancement (S-curve)
			out.data[i] = mean + sign * Math.pow( magi / sigmaR, alpha ) * sigmaR;
		}
	}
	
	return out;
}

function fastLocalContrast(imgGray, means, laplacianPyramids) {

	var maxPyramidNum = laplacianPyramids.length;
	var maxLevel      = laplacianPyramids[0].length;

	// set enhanced residual
	var gaussianPyramid  = [];
	var laplacianPyramid = [];
	buildLaplacianPyramid(imgGray, gaussianPyramid, laplacianPyramid, maxLevel);
	
	var w = [1/9, 2/9, 3/9, 2/9, 1/9];
	for (var level = 0; level < maxLevel-1; ++level) {
		var g = gaussianPyramid[level];
		var total = g.total();
		
		for (var i = 0; i < total; i++) {
			// center mean
			var c = g.at(i);
			
			// find nearest center level
			var minDist = 9999999;
			var idx = -1;
			for (var j = 0; j < maxPyramidNum; ++j) {
				var dist = Math.abs( c - means[j] );
				if (dist < minDist) {
					minDist = dist;
					idx = j;
				}
			}
			
			// Gaussian like blending
			var r = new Array(5);
			r[0] = laplacianPyramids[ clamp(idx-2, 0, maxPyramidNum-1) ][level].at(i);
			r[1] = laplacianPyramids[ clamp(idx-1, 0, maxPyramidNum-1) ][level].at(i);
			r[2] = laplacianPyramids[ clamp(idx  , 0, maxPyramidNum-1) ][level].at(i);
			r[3] = laplacianPyramids[ clamp(idx+1, 0, maxPyramidNum-1) ][level].at(i);
			r[4] = laplacianPyramids[ clamp(idx+2, 0, maxPyramidNum-1) ][level].at(i);
			
			laplacianPyramid[level].data[i] = r[0] * w[0] + 
											  r[1] * w[1] +
											  r[2] * w[2] +
											  r[3] * w[3] +
											  r[4] * w[4];
		} // end of pixels
	} // end of levels
	
	return reconstructionLaplacianPyramid( laplacianPyramid );
}

function getMeans(imgGray, maxPyramidNum) {
	var meanMat = new Mat( imgGray );
	meanMat.data.sort();
	
	// find mean range
	var minV = meanMat.data[ Math.ceil( meanMat.total() * 0.0001 ) ];
	var maxV = meanMat.data[ Math.ceil( meanMat.total() * 0.9999 ) ];
	var step = (maxV - minV) / (maxPyramidNum-2);
	var means = new Array( maxPyramidNum );
	means[0] = minV;
	means[maxPyramidNum-1] = maxV;
	for (var i = 1; i < maxPyramidNum-1; ++i) {
		means[i] = means[i-1] + step;
	}
	
	return means;
}

function glRemappingLaplacianPyramids(imgGray, means, maxLevel) {
	var maxPyramidNum = means.length;
	var laplacianPyramids = new Array( maxPyramidNum );
	for (var i = 0; i < maxPyramidNum; i+=4) {
		var rmpArray = new Array(4);
		rmpArray[0] = remapLuma(imgGray, means[i+0], alpha, beta, sigmaR);
		rmpArray[1] = remapLuma(imgGray, means[i+1], alpha, beta, sigmaR);
		rmpArray[2] = remapLuma(imgGray, means[i+2], alpha, beta, sigmaR);
		rmpArray[3] = remapLuma(imgGray, means[i+3], alpha, beta, sigmaR);
		var rmpMat = merge( rmpArray );
		
		// downsample smooth
		var dSmooth = glFilter2D(rmpMat, kernelDown);
		
		// downsample
		//var dImg = createMat(rows, cols, dSmooth.channel);
		//for (var sy = 0, by = 0; sy < dImg.rows; sy++, by+=2) {
		//	for (var sx = 0, bx = 0; sx < dImg.cols; sx++, bx+=2) {
		//		dImg.set(sy, sx, dSmooth.get(by, bx));
		//	}
		//} // end of for
		
		// upsample smooth
		
		showImage('dSmooth'+i, dSmooth);
		
		// downsample halfsize
	}
}

function remappingLaplacianPyramids(imgGray, means, maxLevel) {
	var maxPyramidNum = means.length;

	var laplacianPyramids = new Array( maxPyramidNum );
	for (var i = 0; i < maxPyramidNum; ++i) {
		//remapLuma(matIn, mean, alpha, beta, sigmaR)
		var tmp = remapLuma(imgGray, means[i], alpha, beta, sigmaR);
		
		// build gaussian pyramid and laplacian pyramid
		var gaussianPyramid = [];
		var laplacianPyramid = [];
		buildLaplacianPyramid(tmp, gaussianPyramid, laplacianPyramid, maxLevel);
		
		// showImage('p'+i, reconstructionLaplacianPyramid(laplacianPyramid));
		
		laplacianPyramids[i] = laplacianPyramid;
	}
	
	return laplacianPyramids;
}