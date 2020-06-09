function ShaderProgram(gl, vSrc, fSrc) { 
    this.gl = gl;
}

ShaderProgram.prototype.createProgram = function(vSrc, fSrc) {
    this.vSrc = vSrc;
    this.fSrc = fSrc;
    this.pInfo = this.createProgramInfoFromSources(vSrc, fSrc);        
}

ShaderProgram.prototype.createShaderFromSource = function (type, src) {
    var gl = this.gl;
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
      // Something went wrong during compilation; get the error
      var lastError = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw lastError;
    }
    return shader;
}    

ShaderProgram.prototype.createProgramInfoFromSources = function (vSrc, fSrc) {
    var gl = this.gl;
    var vShader = this.createShaderFromSource(gl.VERTEX_SHADER, vSrc);        
    var fShader = this.createShaderFromSource(gl.FRAGMENT_SHADER, fSrc);
    var program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    /*
    gl.detachShader(program, vShader);
    gl.detachShader(program, fShader);
    gl.deleteShader(vShader);
    gl.deleteShader(fShader);
    */    
    if ( !gl.getProgramParameter( program, gl.LINK_STATUS) ) {
        var info = gl.getProgramInfoLog(program);
        throw 'Could not compile WebGL program. \n\n' + info;
    }
    var programInfo = twgl.createProgramInfoFromProgram(gl, program);
    return programInfo;    
}    

//-----------------------------------------------------------------------------

function SimpleShaderProgram(gl) {
    ShaderProgram.call(this, gl);
    this.createProgram(SimpleShaderProgram.vSrc, SimpleShaderProgram.fSrc);
}

SimpleShaderProgram.prototype = Object.create(ShaderProgram.prototype);
SimpleShaderProgram.prototype.constructor = SimpleShaderProgram;


SimpleShaderProgram.vSrc = `
uniform mat4 u_worldViewProjection;
attribute vec4 a_position;
attribute vec3 a_color;
varying vec4 v_position;
varying vec3 v_color;
void main() {
  v_position = (u_worldViewProjection * a_position);
  gl_Position = v_position;
  v_color = a_color;
}
`;
SimpleShaderProgram.fSrc = `
precision mediump float;
varying vec3 v_color;
void main() {
    gl_FragColor = vec4(1.0,0.0,1.0,1.0); // v_color, 1.0);
}
`;


//-----------------------------------------------------------------------------

function SurfaceShaderProgram(gl) {
    ShaderProgram.call(this, gl);
    var vSrc = this.makeVSrc();
    this.createProgram(vSrc, SurfaceShaderProgram.fSrc);
}

SurfaceShaderProgram.prototype = Object.create(ShaderProgram.prototype);
SurfaceShaderProgram.prototype.constructor = SurfaceShaderProgram;

SurfaceShaderProgram.prototype.makeVSrc = function(body)  {
    body = body || 'p.x=u;p.y=v;';
    var src =  SurfaceShaderProgram.vSrc_header + body +
        SurfaceShaderProgram.vSrc_footer;    
    return src;
}

SurfaceShaderProgram.prototype.setBody = function(body) {
    gl.deleteProgram(this.pInfo.program);
    var vSrc = this.makeVSrc(body);
    this.createProgram(vSrc, SurfaceShaderProgram.fSrc);
}



SurfaceShaderProgram.vSrc_header = `
uniform mat4 u_world;
uniform mat4 u_viewInverse;
uniform mat4 u_worldViewProjection;
uniform mat4 u_worldInverseTranspose;
uniform vec3 u_lightWorldPos;
uniform float u_time;
attribute vec2 a_texcoord;
varying vec4 v_position;
varying vec3 v_normal;
varying vec3 v_surfaceToLight;
varying vec3 v_surfaceToView;

uniform float u_cc[10];

#define PI 3.1415926535897932384626433832795

vec3 rx(vec3 p, float ang) {
    float cs = cos(ang), sn = sin(ang);
    return vec3(p.x,cs*p.y-sn*p.z,sn*p.y+cs*p.z);
}

vec3 ry(vec3 p, float ang) {
    float cs = cos(ang), sn = sin(ang);
    return vec3(cs*p.x-sn*p.z,p.y,sn*p.x+cs*p.z);
}

vec3 rz(vec3 p, float ang) {
    float cs = cos(ang), sn = sin(ang);
    return vec3(cs*p.x-sn*p.y,sn*p.x+cs*p.y,p.z);
}

vec3 fun(float u, float v) {  
    vec3 p = vec3(0.0,0.0,0.0);
`;
SurfaceShaderProgram.vSrc_footer = `  
  return p;
}

void main() {
  
  float u = a_texcoord.x;
  float v = a_texcoord.y;
  
  vec4 pos = vec4(fun(u,v),1.0);
  float h = 0.01;
  vec3 dfdu = fun(u+h,v)-fun(u-h,v);
  vec3 dfdv = fun(u,v+h)-fun(u,v-h);
  vec3 norm = normalize(cross(dfdu,dfdv));
  
  
  v_position = (u_worldViewProjection * pos);
  v_normal = (u_worldInverseTranspose * vec4(norm, 0)).xyz;
  v_surfaceToLight = u_lightWorldPos - (u_world * pos).xyz;
  v_surfaceToView = (u_viewInverse[3] - (u_world * pos)).xyz;
  
  gl_Position = v_position;
}
`;
SurfaceShaderProgram.fSrc = `  
precision mediump float;
varying vec4 v_position;
varying vec3 v_normal;
varying vec3 v_surfaceToLight;
varying vec3 v_surfaceToView;
uniform vec4 u_lightColor;
uniform vec4 u_diffuseMult;
uniform vec4 u_specular;
uniform float u_shininess;
uniform float u_specularFactor;

vec4 lit(float l ,float h, float m) {
  return vec4(1.0,
              abs(l),//max(l, 0.0),
              (l > 0.0) ? pow(max(0.0, h), m) : 0.0,
              1.0);
}
void main() {
  vec4 diffuseColor = vec4(0.3,0.8,0.9,1.0);
  vec3 a_normal = normalize(v_normal);
  vec3 surfaceToLight = normalize(v_surfaceToLight);
  vec3 surfaceToView = normalize(v_surfaceToView);
  vec3 halfVector = normalize(surfaceToLight + surfaceToView);
  
  if(dot(surfaceToView, a_normal)<0.0) {
    diffuseColor = vec4(0.9,0.9,0.1,1.0);
    a_normal = -a_normal;
  }
  float cs = dot(a_normal, surfaceToLight);
  vec4 litR = lit(cs,dot(a_normal, halfVector), u_shininess);
  vec4 outColor = vec4((
  u_lightColor * (diffuseColor * litR.y +
                0.7 * litR.z * u_specularFactor)).rgb,
      diffuseColor.a);
  gl_FragColor = outColor;
}
`;


//-----------------------------------------------------------------------------


function BackgroundShaderProgram(gl) {
    ShaderProgram.call(this, gl);
    this.createProgram(BackgroundShaderProgram.vSrc, BackgroundShaderProgram.fSrc);
}

BackgroundShaderProgram.prototype = Object.create(ShaderProgram.prototype);
BackgroundShaderProgram.prototype.constructor = BackgroundShaderProgram;


BackgroundShaderProgram.vSrc = `
uniform mat4 u_worldViewProjection;
attribute vec4 a_position;
attribute vec2 a_texcoord;
varying vec4 v_position;
varying vec2 v_uv;
void main() {
  v_position = (u_worldViewProjection * a_position);
  gl_Position = v_position;
  v_uv = a_texcoord;
}
`;

BackgroundShaderProgram.fSrc = `
precision mediump float;
varying vec2 v_uv;
void main() {
    float y = v_uv.y;
    vec3 c1 = vec3(0.97,0.82,0.99);
    vec3 c2 = vec3(0.85,0.96,0.99);
    vec3 c = (1.0-y)*c1 + y*c2;
    
    gl_FragColor = vec4(c*0.9, 1.0);
}
`;



//-----------------------------------------------------------------------------
// vertex shader
//-----------------------------------------------------------------------------
ProgramManager.sources = {
    parametricSurface: {},
    lines: {}    
};


ProgramManager.sources.parametricSurface.vSrc1 = `  
uniform mat4 u_world;
uniform mat4 u_viewInverse;
uniform mat4 u_worldViewProjection;
uniform mat4 u_worldInverseTranspose;
uniform vec3 u_lightWorldPos;
uniform float u_time;
attribute vec2 a_texcoord;
varying vec4 v_position;
varying vec3 v_normal;
varying vec3 v_surfaceToLight;
varying vec3 v_surfaceToView;

uniform float u_cc[10];

#define PI 3.1415926535897932384626433832795


vec3 rx(vec3 p, float ang) {
    float cs = cos(ang);
    float sn = sin(ang);
    return vec3(p.x,cs*p.y-sn*p.z,sn*p.y+cs*p.z);
}

vec3 ry(vec3 p, float ang) {
    float cs = cos(ang);
    float sn = sin(ang);
    return vec3(cs*p.x-sn*p.z,p.y,sn*p.x+cs*p.z);
}

vec3 rz(vec3 p, float ang) {
    float cs = cos(ang);
    float sn = sin(ang);
    return vec3(cs*p.x-sn*p.y,sn*p.x+cs*p.y,p.z);
}

vec3 zero = vec3(0.0,0.0,0.0);

vec3 tx(vec3 p, float x) { return p + vec3(x,0.0,0.0); }
vec3 ty(vec3 p, float y) { return p + vec3(0.0,y,0.0); }
vec3 tz(vec3 p, float z) { return p + vec3(0.0,0.0,z); }

vec3 cxy(vec3 p, float r, float ang) { return rz(p+vec3(r,0.0,0.0), ang); }
vec3 cxz(vec3 p, float r, float ang) { return ry(p+vec3(r,0.0,0.0), ang); }
vec3 cyz(vec3 p, float r, float ang) { return rx(p+vec3(0.0,r,0.0), ang); }

vec3 fun(float u, float v) {  
    u = u*2.0 - 1.0;
    v = v*2.0 - 1.0;
    float t = u_time;
    float x=0.0,y=0.0,z=0.0;
    float A = u_cc[0];
    float B = u_cc[1];
    float C = u_cc[2];
    float D = u_cc[3];
    float E = u_cc[4];
    vec3 p = vec3(0,0,0);
`;


ProgramManager.sources.parametricSurface.vSrc2a = `
`;


ProgramManager.sources.parametricSurface.vSrc3 = `
  
  return p;
}

void main() {
  
  float u = a_texcoord.x;
  float v = a_texcoord.y;
  
  vec4 pos = vec4(fun(u,v),1.0);
  float h = 0.001;
  vec3 dfdu = fun(u+h,v)-fun(u-h,v);
  vec3 dfdv = fun(u,v+h)-fun(u,v-h);
  vec3 norm = normalize(cross(dfdu,dfdv));
  
  
  v_position = (u_worldViewProjection * pos);
  v_normal = (u_worldInverseTranspose * vec4(norm, 0)).xyz;
  v_surfaceToLight = u_lightWorldPos - (u_world * pos).xyz;
  v_surfaceToView = (u_viewInverse[3] - (u_world * pos)).xyz;
  
  
  
  gl_Position = v_position;
}
`;

//-----------------------------------------------------------------------------
// fragment shader
//-----------------------------------------------------------------------------


ProgramManager.sources.parametricSurface.fSrc = `
precision mediump float;
varying vec4 v_position;
varying vec3 v_normal;
varying vec3 v_surfaceToLight;
varying vec3 v_surfaceToView;
uniform vec4 u_lightColor;
uniform vec4 u_diffuseMult;
uniform vec4 u_specular;
uniform float u_shininess;
uniform float u_specularFactor;

vec4 lit(float l ,float h, float m) {
  return vec4(1.0,
              abs(l),//max(l, 0.0),
              (l > 0.0) ? pow(max(0.0, h), m) : 0.0,
              1.0);
}
void main() {
  vec4 diffuseColor = vec4(0.3,0.8,0.9,1.0);
  vec3 a_normal = normalize(v_normal);
  vec3 surfaceToLight = normalize(v_surfaceToLight);
  vec3 surfaceToView = normalize(v_surfaceToView);
  vec3 halfVector = normalize(surfaceToLight + surfaceToView);
  
  if(dot(surfaceToView, a_normal)<0.0) {
    diffuseColor = vec4(0.9,0.9,0.1,1.0);
    a_normal = -a_normal;
  }
  float cs = dot(a_normal, surfaceToLight);
  vec4 litR = lit(cs,dot(a_normal, halfVector), u_shininess);
  vec4 outColor = vec4((
  u_lightColor * (diffuseColor * litR.y +
                0.7 * litR.z * u_specularFactor)).rgb,
      diffuseColor.a);
  gl_FragColor = outColor;
}
`;

//-----------------------------------------------------------------------------

// lines 
ProgramManager.sources.lines.vSrc = `
uniform mat4 u_world;
uniform mat4 u_viewInverse;
uniform mat4 u_worldViewProjection;
uniform mat4 u_worldInverseTranspose;
uniform vec3 u_lightWorldPos;
uniform float u_time;
attribute vec4 a_position;
attribute vec3 a_color;
varying vec4 v_position;
varying vec3 v_color;
varying vec3 v_surfaceToLight;
varying vec3 v_surfaceToView;
void main() {
  v_position = (u_worldViewProjection * a_position);
  // v_normal = (u_worldInverseTranspose * vec4(a_normal, 0)).xyz;
  v_surfaceToLight = u_lightWorldPos - (u_world * a_position).xyz;
  v_surfaceToView = (u_viewInverse[3] - (u_world * a_position)).xyz;
  gl_Position = v_position;
  v_color = a_color;
}
`;

ProgramManager.sources.lines.fSrc = `
precision mediump float;
varying vec3 v_color;
void main() {
    gl_FragColor = vec4(v_color, 1.0);
}
`;


//-----------------------------------------------------------------------------
// program handling
//-----------------------------------------------------------------------------


function ProgramManager(gl) {
    this.gl = gl;
    
    var s = ProgramManager.sources.lines;
    this.linesProgram = this.createProgramInfoFromSources(s.vSrc, s.fSrc);
    s = ProgramManager.sources.parametricSurface;
    this.parametricSurfaceProgram = this.createProgramInfoFromSources(s.vSrc1 + s.vSrc2a + s.vSrc3, s.fSrc);
    // this.patchProgram(ProgramManager.vSrc2a);
}


ProgramManager.prototype.createShaderFromSource = function (type, src) {
    var gl = this.gl;
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
      // Something went wrong during compilation; get the error
      var lastError = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw lastError;
    }
    return shader;
}    

ProgramManager.prototype.createProgramInfoFromSources = function (vSrc, fSrc) {
    var gl = this.gl;
    var vShader = this.createShaderFromSource(gl.VERTEX_SHADER, vSrc);        
    var fShader = this.createShaderFromSource(gl.FRAGMENT_SHADER, fSrc);
    var program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    /*
    gl.detachShader(program, vShader);
    gl.detachShader(program, fShader);
    gl.deleteShader(vShader);
    gl.deleteShader(fShader);
    */    
    if ( !gl.getProgramParameter( program, gl.LINK_STATUS) ) {
        var info = gl.getProgramInfoLog(program);
        throw 'Could not compile WebGL program. \n\n' + info;
    }
    var programInfo = twgl.createProgramInfoFromProgram(gl, program);
    return programInfo;    
}    


ProgramManager.prototype.getCurrentProgramInfo = function () { return this.parametricSurfaceProgram; }


ProgramManager.prototype.patchProgram = function(src) {
    var s = ProgramManager.sources.parametricSurface;
    var program = this.createProgramInfoFromSources(s.vSrc1 + src + s.vSrc3, s.fSrc);
    gl.deleteProgram(this.parametricSurfaceProgram.program);
    this.parametricSurfaceProgram = program;      
}
