const vertexShaderSource = `
attribute vec4 aVertexPosition;
attribute vec2 aTextureCoord;
varying vec2 vTextureCoord;
void main() {
    gl_Position = aVertexPosition;
    vTextureCoord = aTextureCoord;
}
`;

const fragmentShaderSource = `
precision mediump float;
varying vec2 vTextureCoord;
uniform float uRotation;
uniform float uBlendFalloff;
uniform float uBlendOffset;
uniform float uScale;
uniform vec2 uResolution;
uniform sampler2D uSampler;
uniform bool uUseTexture;

const float FULL_ROTATION = 6.28318530718;
const vec2 CELL_CENTER = vec2(0.5, 0.5);

vec2 generateRandomVector(vec2 position) {
    vec3 hash = fract(vec3(position.xyx) * vec3(443.897, 441.423, 437.195));
    hash += dot(hash, hash.yzx + 19.19);
    return fract((hash.xx + hash.yz) * hash.zy);
}

vec2 rotateUV(vec2 uv, float angle, vec2 center) {
    vec2 delta = uv - center;
    float s = sin(angle);
    float c = cos(angle);
    delta = vec2(delta.x * c - delta.y * s, delta.x * s + delta.y * c);
    return delta + center;
}

vec4 samplePattern(vec2 uv) {
    if (uUseTexture) {
        return texture2D(uSampler, uv);
    }
    float checkerboard = mod(floor(uv.x) + floor(uv.y), 2.0);
    return vec4(mix(vec3(0.8), vec3(0.6), checkerboard), 1.0);
}

void main() {
    // Scaling for webpage weirdness
    vec2 pixelCoord = vTextureCoord * uResolution;
    vec2 centeredPixel = pixelCoord - 0.5 * uResolution;
    vec2 squareCoord = centeredPixel / min(uResolution.x, uResolution.y);
    vec2 uv = squareCoord * uScale * 4.0;
    
    // Resume normal shader here
    vec2 gridPosition = floor(uv);
    vec2 nearestCorner = gridPosition;
    vec2 nearestCenter = gridPosition + CELL_CENTER;
    float minDistCell = dot(uv - nearestCorner, uv - nearestCorner);
    float minDistOffset = dot(uv - nearestCenter, uv - nearestCenter) * uBlendOffset;

    vec2 corners[4];
    corners[0] = gridPosition;
    corners[1] = gridPosition + vec2(0.0, 1.0);
    corners[2] = gridPosition + vec2(1.0, 0.0);
    corners[3] = gridPosition + vec2(1.0, 1.0);

    for(int i = 1; i < 4; i++) {
        vec2 cornerPos = corners[i];
        vec2 centerPos = cornerPos + CELL_CENTER;
        float distCell = dot(uv - cornerPos, uv - cornerPos);
        float distOffset = dot(uv - centerPos, uv - centerPos) * uBlendOffset;
        if(distCell < minDistCell) {
            minDistCell = distCell;
            nearestCorner = cornerPos;
        }
        if(distOffset < minDistOffset) {
            minDistOffset = distOffset;
            nearestCenter = centerPos;
        }
    }

    vec2 random1 = generateRandomVector(nearestCorner) + 1.0;
    vec2 random2 = generateRandomVector(nearestCenter - CELL_CENTER) + 1.0;

    vec2 rotatedUV1 = rotateUV(uv, uRotation * FULL_ROTATION * random1.x, nearestCorner);
    vec2 rotatedUV2 = rotateUV(uv, uRotation * FULL_ROTATION * random2.x, nearestCenter);

    float blendFactor = clamp((minDistOffset - minDistCell) * uBlendFalloff, 0.0, 1.0);
    vec4 color1 = samplePattern(fract(rotatedUV1));
    vec4 color2 = samplePattern(fract(rotatedUV2));
    gl_FragColor = mix(color2, color1, blendFactor);
}
`;

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Shader program failed to link: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }
    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader failed to compile: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function main() {
    const canvas = document.querySelector("#glCanvas");
    const gl = canvas.getContext("webgl");
    if (!gl) {
        alert("Unable to initialize WebGL");
        return;
    }

    // Only update the canvas size when the window is resized.
    function resizeCanvasToDisplaySize(canvas) {
        const width = canvas.clientWidth * window.devicePixelRatio;
        const height = canvas.clientHeight * window.devicePixelRatio;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
    }

    // Initial resize.
    resizeCanvasToDisplaySize(canvas);

    // Update canvas size on window resize.
    window.addEventListener('resize', () => {
        resizeCanvasToDisplaySize(canvas);
        drawScene();
    });

    const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
    let useTexture = false;
    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
        },
        uniformLocations: {
            rotation: gl.getUniformLocation(shaderProgram, 'uRotation'),
            blendFalloff: gl.getUniformLocation(shaderProgram, 'uBlendFalloff'),
            blendOffset: gl.getUniformLocation(shaderProgram, 'uBlendOffset'),
            scale: gl.getUniformLocation(shaderProgram, 'uScale'),
            resolution: gl.getUniformLocation(shaderProgram, 'uResolution'),
            sampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
            useTexture: gl.getUniformLocation(shaderProgram, 'uUseTexture'),
        },
    };

    const positions = new Float32Array([
        -1.0,  1.0,
         1.0,  1.0,
        -1.0, -1.0,
         1.0, -1.0,
    ]);
    const textureCoordinates = new Float32Array([
        0.0, 1.0,
        1.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,
    ]);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, textureCoordinates, gl.STATIC_DRAW);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255])
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    function loadImageTexture(imagePath) {
        const image = new Image();
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            useTexture = true;
            drawScene();
        };
        image.src = imagePath;
    }

    // Load default image texture.
    loadImageTexture('./examples/lava.png');

    ['rotation', 'blendFalloff', 'blendOffset', 'scale'].forEach(id => {
        const element = document.getElementById(id);
        const valueDisplay = element.nextElementSibling;
        element.addEventListener('input', () => {
            valueDisplay.textContent = element.value;
            drawScene();
        });
    });

    document.getElementById('imageInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const image = new Image();
                image.onload = () => {
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                    useTexture = true;
                    drawScene();
                };
                image.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.querySelectorAll('.example-image').forEach(img => {
        img.addEventListener('click', () => {
            loadImageTexture(img.src);
        });
    });

    function drawScene() {
        // Do not recalculate canvas size on every draw.
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(programInfo.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

        gl.uniform1f(programInfo.uniformLocations.rotation, parseFloat(document.getElementById('rotation').value));
        gl.uniform1f(programInfo.uniformLocations.blendFalloff, parseFloat(document.getElementById('blendFalloff').value));
        gl.uniform1f(programInfo.uniformLocations.blendOffset, parseFloat(document.getElementById('blendOffset').value));
        gl.uniform1f(programInfo.uniformLocations.scale, parseFloat(document.getElementById('scale').value));
        gl.uniform2f(programInfo.uniformLocations.resolution, canvas.width, canvas.height);
        gl.uniform1i(programInfo.uniformLocations.useTexture, useTexture);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(programInfo.uniformLocations.sampler, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}

window.onload = main;
