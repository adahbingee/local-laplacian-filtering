var gl;

function onWebGL( img ) {
	// get renderer
	var canvas = document.getElementById("webgl");
	canvas.width  = img.cols;
	canvas.height = img.rows;
	gl = getWebGLContext(canvas);
	if ( !gl ) return;
	
	// setup GLSL program
	var program = createProgramFromScripts(gl, ["2d-vertex-shader", "2d-fragment-shader"]);
	gl.useProgram(program);
	
	// set texture
	var texture = allocateTexture( img );
	
	// allocate sprite vertex
	setShderParam( program, img );
	
	// make a framebuffer
	var fb = allocateFrameBuffer( texture );

	// Draw the rectangle.
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	
	// bind the framebuffer
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
	// read the pixels
	var buf = new Float32Array( img.data.length );
	gl.readPixels(0, 0, img.cols, img.rows, gl.RGBA, gl.FLOAT, buf);
	// Unbind the framebuffer
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function setShderParam( program, img ) {
	// look up where the vertex data needs to go.
	var positionLocation    = gl.getAttribLocation(program, "a_position");
	var texCoordLocation    = gl.getAttribLocation(program, "a_texCoord");
	var kernelLocation      = gl.getUniformLocation(program, "u_kernel[0]");
	var resolutionLocation  = gl.getUniformLocation(program, "u_resolution");
	var textureSizeLocation = gl.getUniformLocation(program, "u_textureSize");
	
	// provide texture coordinates for the rectangle.
	var texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	setRectangle(gl, 0, 0, 1, 1);
	gl.enableVertexAttribArray(texCoordLocation);
	gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
	
	// Create a buffer for the position of the rectangle corners.
	var buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	setRectangle(gl, 0, 0, img.cols, img.rows);
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	
	// set the resolution
	gl.uniform2f(resolutionLocation, img.cols, img.rows);
	
	// set the size of the image
	gl.uniform2f(textureSizeLocation, img.cols, img.rows);
	
	// set kernel
	gl.uniform1fv(kernelLocation, kernelDown.data);
}

function allocateFrameBuffer( texture ) {
	var fb = gl.createFramebuffer();
	// make this the current frame buffer
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
	// attach the texture to the framebuffer.
	gl.framebufferTexture2D(
		gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
		gl.TEXTURE_2D, texture, 0);
	// Unbind the framebuffer
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	
	return fb;
}

function allocateTexture( img ) {
	// set float texture support
	gl.getExtension("OES_texture_float");

	// Create a texture.
	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	
	// Set the parameters so we can render any size image.
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	
	// transform image data to float array
	var data = new Float32Array( img.data.length );
	for (var i = 0; i < img.data.length; ++i) {
		data[i] = img.data[i];
	}
	
	// Upload the image into the texture.
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.cols, img.rows, 0, gl.RGBA, gl.FLOAT, data);
	
	return texture;
}

function setRectangle(gl, x, y, width, height) {
	var x1 = x;
	var x2 = x + width;
	var y1 = y;
	var y2 = y + height;
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
	 x1, y1,
	 x2, y1,
	 x1, y2,
	 x1, y2,
	 x2, y1,
	 x2, y2]), gl.STATIC_DRAW);
}