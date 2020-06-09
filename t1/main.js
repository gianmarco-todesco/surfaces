var viewer;

var sphere = `
    float theta = PI * u;
    float phi = 2.0 * PI * v;

    float radius = 1.0;
    
    float rxz = radius * sin(theta);
    float x = rxz * cos(phi);
    float y = rxz * sin(phi);
    float z = radius * cos(theta);
    
    p = vec3(x,y,z);

`;

var torus = `
    float theta = 2.0 * PI * u;
    float phi = 2.0 * PI * v;

    float big_radius = 0.8;
    float small_radius = 0.2;
    
    
    float rxz = big_radius + small_radius * sin(theta);
    float x = rxz * cos(phi);
    float y = rxz * sin(phi);
    float z = small_radius * cos(theta);
    
    p = vec3(x,y,z);

`;



var strange_guy = `
float phi = u*2.*PI;
float theta = v*2.*PI;

float gamma = 0.4;

float r1 = 1.0;
float r2 = 0.5 + 0.02*sin(theta*13.0 + 5.0*phi) ;

float q = sin(2.0*PI*u_time);
r2 = r2 * (0.5 + gamma*sin(phi*5.0)*q) ;

float csPhi = cos(phi), snPhi = sin(phi);
float csTheta = cos(theta), snTheta = sin(theta);
float r = r1 + r2*snTheta;
p = vec3(r*csPhi,r*snPhi,r2*csTheta);
`;


var formula = strange_guy;

window.onload = function() {
    viewer = new SurfaceViewer('surface-viewer');
    viewer.setBody(formula);
    function animate() {
        var time = performance.now()*0.0005;
        time -= Math.floor(time);
        viewer.uniforms.u_time = time;
        viewer.drawScene();
        // tick();
        requestAnimationFrame(animate);
    }
    animate();
}



