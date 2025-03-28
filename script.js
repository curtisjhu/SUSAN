import { infotext } from "./js/infotext.js";
import * as THREE from './js/build/three.module.js';
import { nodeFrame } from './js/jsm/renderers/webgl/nodes/WebGLNodes.js';
import { OrbitControls } from './js/jsm/controls/OrbitControls.js'; //movement controls

import { GLTFLoader } from './js/jsm/loaders/GLTFLoader.js'; //3D model loader
import { FBXLoader } from './js/jsm/loaders/FBXLoader.js'; // Sphere fbx loader

import { RoomEnvironment } from './js/jsm/environments/RoomEnvironment.js'; // background of model
import { GUI } from './js/jsm/libs/lil-gui.module.min.js'; // for GUI interaction
import { DecalGeometry } from './js/jsm/geometries/DecalGeometry.js'; // for decals
// for glow:
import { EffectComposer } from './js/jsm/postprocessing/EffectComposer.js';
import { OutlinePass } from './js/jsm/postprocessing/OutlinePass.js';
import { FXAAShader } from './js/jsm/shaders/FXAAShader.js';
import { RenderPass } from './js/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from './js/jsm/postprocessing/ShaderPass.js';


let container;
let camera, scene, renderer, controls; // universal use of basic model components
let composer, effectFXAA, outlinePass, clickedPass;

// model and highlights
let selectedObjects = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let susan = [];
let susanmodel, planemodel, wires;
const manager = new THREE.LoadingManager();

//set up basic elements of camera, scene, renderer
//let camera, scene, renderer, controls; 
let panel, xcontroller, ycontroller, zcontroller; // controllers for the GUI
let zoomin = false;
let panelratio = 1; // percentage size of the window that the animation is
let windowwidth = window.innerWidth * panelratio;
let windowheight = window.innerHeight * panelratio;

if (windowwidth > 800){
	document.getElementById("partinfo").style.fontSize = "large";
	document.getElementById("partinfo").style.fontWeight = "normal";
	document.getElementById("infotitle").style.fontSize = "large";
} else if (windowwidth > 500 && windowwidth < 800){
	document.getElementById("partinfo").style.fontSize = "medium";
	document.getElementById("partinfo").style.fontWeight = "normal";
	document.getElementById("infotitle").style.fontSize = "medium";
} else {
	document.getElementById("partinfo").style.fontSize = "small";
	document.getElementById("partinfo").style.fontWeight = "normal";
	document.getElementById("infotitle").style.fontSize = "small";
}



//set up mouse over (raycaster)
let intersects = []; //current moused over item
let sky, light, alight, settings; //sky object, light object, and the settings for the GUI

//set up parts of model
let infolist = infotext();
let parttitlelist = infolist['mytitles'];
let partinfolist = infolist['myinfo'];
let partinfo = partinfolist[partinfolist.length-1]; //strings to contain the html code for the part info that changes on click
let parttitle = parttitlelist[parttitlelist.length-1]; //strings to contain the html code for the part title that changes on click
let zoomscreen = new THREE.Vector3(-64, 30, -50); //default zooming
let partcoordinatelist = [
	new THREE.Vector3(23, 22, 68), // wires
	new THREE.Vector3(25, 50, -50), // wings
	new THREE.Vector3(-55, 25, 45), // body
	new THREE.Vector3(2, 4, -50), // engines
	new THREE.Vector3(23, 22, 68), // tail
	new THREE.Vector3(32, 8, 36), // back engine
	new THREE.Vector3(32, 8, 36), // back engine cover
	new THREE.Vector3(-64, 15, -35), //cockpit
	zoomscreen,
]

/* -------------------- DECALS -------------------- */
const intersection = {
	intersects: false,
	point: new THREE.Vector3(),
	normal: new THREE.Vector3()
};
const mouse = new THREE.Vector2();
const textureLoader = new THREE.TextureLoader();
let decalalbedo;
decalalbedo = textureLoader.load( 'models/images/NASA_logo.png' );
const decalMaterial = new THREE.MeshPhongMaterial( {
		specular: 0xf0f0ff,
		map: decalalbedo,
		shininess: 100,
		depthTest: true,
		depthWrite: false,
		polygonOffset: true,
		polygonOffsetFactor: -6,
		wireframe: false
	} );
const decals = [];
let mouseHelper;
let posit = new THREE.Vector3();
const orientation = new THREE.Euler();
const siz = new THREE.Vector3();
const decalparams = {
		minScale: 1,
		maxScale: 2,
		rotate: true,
		clear: function () {
			removeDecals();
		}
	};
/* ------------------------------------------------ */



init();
animate();

function init() {
	// creates a new div element to render so that the rest of the page stays the same.
	const container = document.createElement('div');
	document.body.appendChild(container);

	camera = new THREE.PerspectiveCamera(45, windowwidth / windowheight, 1, 200000);
	scene = new THREE.Scene();

/* -------------------- SET UP CAMERA RENDERER & POSTPROCESSING -------------------- */
	camera.position.set(zoomscreen.x, zoomscreen.y, zoomscreen.z);
	camera.lookAt(0, 0, 0);

	// set up the renderer
	// all of this is pretty standard and I am not going to touch it
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio); // pixel ratio render
	renderer.setSize(windowwidth, windowheight); // size of animation, constant
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;
	renderer.outputEncoding = THREE.sRGBEncoding;
	container.appendChild(renderer.domElement);

	// set environment and generate
	const environment = new RoomEnvironment();
	const pmremGenerator = new THREE.PMREMGenerator(renderer);
	scene.background = new THREE.Color(0xbbbbbb); // yes the background is gray but there's a pretty skybox to look at
	scene.environment = pmremGenerator.fromScene(environment).texture;	
	
	// set up postprocessing
	composer = new EffectComposer( renderer );
	const renderPass = new RenderPass( scene, camera );
	composer.addPass( renderPass );
	effectFXAA = new ShaderPass( FXAAShader );
	effectFXAA.uniforms[ 'resolution' ].value.set( 1 / windowwidth, 1 / windowheight );
	composer.addPass( effectFXAA );
	
	// set up outlinePass
	outlinePass = new OutlinePass( new THREE.Vector2( windowwidth, windowheight ), scene, camera );
	composer.addPass( outlinePass );
	outlinePass.edgeStrength = 4.0;
	outlinePass.edgeGlow = 0.7;
	outlinePass.edgeThickness = 6.0;
	outlinePass.pulsePeriod = 0;
	outlinePass.visibleEdgeColor.set(0x999999);
	outlinePass.hiddenEdgeColor.set(0x190A05);

	clickedPass = new OutlinePass( new THREE.Vector2( windowwidth, windowheight ), scene, camera );
	composer.addPass( clickedPass );
	clickedPass.edgeStrength = 4.0;
	clickedPass.edgeGlow = 0.0;
	clickedPass.edgeThickness = 4.0;
	clickedPass.pulsePeriod = 0;
	clickedPass.visibleEdgeColor.set(0xFF6666);
	clickedPass.hiddenEdgeColor.set(0x991111);
	
/* -------------------- SET UP MODEL VISUALS AND TEXTURE -------------------- */
	light = new THREE.DirectionalLight(0xFFFFFF, 1); // white light, intensity
	light.castShadow = true;
	light.position.set(-100, 50, 0)
	light.name = "light"; // so I can search by name
	alight = new THREE.AmbientLight(0x778899, 0.4);
	scene.add(alight);
	scene.add(light);

	// Setting up skydome
	// Search for equirectangular photo
	let skyGeo = new THREE.SphereGeometry(100, 30, 30);
	// photo does clip, maybe I could try to find a another one... the issue is that they're all paid :(
	// An equirectangular photo is one that is supposed to work as a 3D sphere. 
	let skytexture = new THREE.TextureLoader().load("models/textures/HDR_ATC_Night.jpeg"); 


	let skymaterial = new THREE.MeshBasicMaterial({ map: skytexture, color:0xFFFFFF })
	sky = new THREE.Mesh(skyGeo, skymaterial);
	sky.material.side = THREE.BackSide; // sets material to the inside of the sphere instead of the outside
	sky.name = "sky"; // so I can search by name
	sky.rotateY(Math.PI);
	scene.add(sky);

/* -------------------- SET UP MOUSE CONTROLS AND INTERACTIONS -------------------- */
	// set up controls
	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true; //smooth the controls
	controls.minDistance = 22; // most zoomed in
	controls.maxDistance = 70; // most zoomed out
	controls.target.set(0, 0, 0); // look at 0,0,0
	controls.update(); // update the controls

	window.addEventListener('pointermove', onPointerMove); // to set known pointer location to current pointer location
	window.addEventListener('resize', onWindowResize); // when window zooms in, call onWindowResize
	window.addEventListener('click', onMouseClick);

/* -------------------- LOAD IN MODELS -------------------- */
	// Loading manager!
	manager.onStart = function () {
		document.getElementById("loadingscreen").innerHTML = "<h3>Loading SUSAN simulation...</h3>";
		document.getElementById("loading").style.display = "block";
	}
	manager.onLoad = function ( ) {
		fade(document.getElementById("loading"));
	};
	manager.onError = function () {
		console.log( 'There was an error loading.' );
	};
	manager.onProgress = function ( item, loaded, total ) {
		let percentagedone = (loaded / total * 100);
		//document.getElementById("loadingscreen").innerHTML = "<h3>Loading SUSAN simulation." + (".".repeat(percentagedone % 4)) + " </h3>";
		document.getElementById("percentagebar").style.width = percentagedone + '%';
	}

	// I nave no idea why it works but it sure works
	// thank you stackOverflow
	function fade(element) {
		let op = 1;  // initial opacity
		let timer = setInterval(function () {
			if (op <= 0.1){ // when done fading
				clearInterval(timer);
				element.style.display = 'none'; // set it to fully transparent
			}
			element.style.opacity = op; // reduce the shown opacity
			element.style.filter = 'alpha(opacity=' + op * 100 + ")"; // not sure what this does but it works so I'm not going to touch it
			op -= op * 0.1; // reduce the opacity in the loop
		}, 30); // ms per frame
	}


	let plane = new GLTFLoader(manager);
	plane.load('models/obj/SUSAN_rev_Bri3.glb',
		function (object) {
			susanmodel = object.scene;
			susanmodel.position.set(0, 0, -20);
			susanmodel.traverse(function (child) { //traverse the children
				if (child.isMesh) {
					child.material = new THREE.MeshPhongMaterial({ 
						reflectivity: 1, 
						shininess: 100, 
						map: child.material.map,
						specular: "#f0b2b2",
						side: THREE.DoubleSide
					});
					child.receiveShadow = true;
					child.castShadow = true;

					susan.push(child);
				}
			});
			scene.add(susanmodel);
		}, undefined,
		function (error) {
			console.error(error);
		}
	);


	const pln = new GLTFLoader(manager);
	// load in wire system
	pln.setPath("models/obj/")
		.load("wire_system3.glb",
		function (object) {
			let mattemp;
			object.scene.rotateY(Math.PI); //for some reason it loads in 180 degrees in the wrong direction so rotate it back around
			object.scene.position.set(0, 0, 1.5) //this bugged me for the longest time. It was just sliiiiiightly off TT_TT
			object.scene.traverse(child => { //traverse the children
				if (child.isMesh) {
					mattemp = new THREE.MeshPhongMaterial({ color:0xDDDDDD, reflectivity:0.5, shininess:100, specular:0xf0f0ff });
					child.material = mattemp;
					child.receiveShadow = true;
					child.castShadow = true;
					
					child.name = 'wires';
					susan.push(child);
				}
			});
			scene.add(object.scene);
		},
		undefined,
		function (error) {
			console.error(error);
		}
	);

	// the trasparent plane outline to show where the wires are
	pln.setRequestHeader({ mode: "no-cors" });
	pln.load('SUSAN_rev_Bri3.glb',
		function (object) {
			let mattemp;
			planemodel = object.scene;
			planemodel.position.set(0, 0, -20);
			planemodel.name = "transparentOutline";
			planemodel.traverse(function (child) { //traverse the children
				if (child.isMesh) {
					mattemp = new THREE.MeshPhongMaterial({ color:0xDDDDDD, transparent:true, opacity:0.3 });
					child.material = mattemp;
					child.receiveShadow = true;
					child.castShadow = true;
				}
			});
			scene.add(planemodel);
			planemodel.visible = false;
		}, undefined,
		function (error) {
			console.error(error);
		}
	);

	// not sure why these are here but they're buggy if they aren't so here we are
	createPanel(); //create the GUI
	setupdecals(); //initialize the decal potential
	showInfo(true);//show default title


/* -------------------- DECALS -------------------- */
	document.body.onkeydown = function(e) {
		if (e.key == "-" || e.code == "-" || e.keyCode == 189){
			decalify();
		} else if (e.key == "=" || e.code == "=" || e.keyCode == 187){
			removeDecals();
		}
	}

	// no need for animations, we don't have any at the moment
	//window.requestAnimationFrame(render);					
} 


/* --------------------------------------------------------------------------------------------------------------------- */
/* ----------------------------------------------------- NO TOUCHY ----------------------------------------------------- */
/* --------------------------------------------------------------------------------------------------------------------- */
//when window changes
function onWindowResize() {
	windowwidth = window.innerWidth * panelratio;
	windowheight = window.innerHeight * panelratio;

	camera.aspect = windowwidth / windowheight; // keep camera ratio constant
	camera.updateProjectionMatrix();
	renderer.setSize(windowwidth, windowheight);

	// check whether it's on a phone or a small enough window to cause problems
	if (windowwidth > 800){
		document.getElementById("partinfo").style.fontSize = "large";
		document.getElementById("infotitle").style.fontSize = "large";
	} else if (windowwidth > 500 && windowwidth < 800){
		document.getElementById("partinfo").style.fontSize = "medium";
		document.getElementById("infotitle").style.fontSize = "medium";
	} else {
		document.getElementById("partinfo").style.fontSize = "small";
		document.getElementById("infotitle").style.fontSize = "small";
	}

	composer.setSize(windowwidth, windowheight);
	effectFXAA.uniforms[ 'resolution' ].value.set( 1 / windowwidth, 1 / windowheight );
}

// when the mouse moves:
function onPointerMove(event) {
	// calculate pointer position in normalized device coordinates
	// (-1 to +1) for both components
	var rect = renderer.domElement.getBoundingClientRect();
	
	pointer.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
	pointer.y = - ((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

	// update the picking ray with the camera and pointer position
	raycaster.setFromCamera(pointer, camera);
	intersects = raycaster.intersectObjects(susan);

	/* -------------------- DECALS & OutlinePass -------------------- */
	mouseoverIntersection();//event.clientX, event.clientY );
	/* -------------------- DECALS -------------------- */
}

/* --------------------------------------------------------------------------------------------------------------------- */
/* --------------------------------------------------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------------------------------------------------- */
/* ------------------------------------------------------- DECALS ------------------------------------------------------ */
/* --------------------------------------------------------------------------------------------------------------------- */
//taken and taken apart from https://github.com/mrdoob/three.js/blob/master/examples/webgl_decals.html
// sets up the decals. Could probably have just shoved this into the code where it's called but eh
function setupdecals() {
	// need to somehow set it to the whole uploaded model I think
	mouseHelper = new THREE.Mesh( new THREE.BoxGeometry( 1, 1, 10 ), new THREE.MeshNormalMaterial() );
	mouseHelper.visible = false;
	scene.add( mouseHelper );
}

// make a decal wherever the mouse is at
// yes the name is wonky but hey it's fun
// no touchy
function decalify() {
	if (intersects.length > 0) { 
		// figure out where you are over the plane
		const p = intersects[0].point;
		mouseHelper.position.copy(p);
		intersection.point.copy(p);

		const n = intersects[0].face.normal.clone();
		n.transformDirection( susan[1].matrixWorld );
		n.multiplyScalar(10);
		n.add(intersects[0].point);

		intersection.normal.copy(intersects[0].face.normal);
		mouseHelper.lookAt(n);
	} else{
		intersects.length = 0;
	}

	if (intersects.length == 0) return; //stop the function if not over the plane

	posit.copy( intersection.point );
	orientation.copy( mouseHelper.rotation );
	if ( decalparams.rotate ) orientation.z = Math.random() * 2 * Math.PI;
	siz.set( 3, 3, 3 ); //scale, scale, scale
	const material = decalMaterial.clone();
	const m = new THREE.Mesh( new DecalGeometry( intersects[0].object, posit, orientation, siz ), material );
	decals.push( m );
	scene.add( m );
} 


/* --------------------------------------------------------------------------------------------------------------------- */
/* ----------------------------------------------------- MOUSEOVER ----------------------------------------------------- */
/* --------------------------------------------------------------------------------------------------------------------- */
// checks whether the mouse is over wherever it should be to make something happen
// Those really fiddly bits when the mouse goes over a part and it turns a different color
// surprisingly less fiddly once I stopped using material.emissive
function mouseoverIntersection(){ //x, y){
	if (intersects.length > 0) { //Check if there are objects that are intersected
		//if (CLICKED.indexOf(intersects[0].object) == -1) { // check that it is not the same object as has been clicked
			outlinePass.selectedObjects = [intersects[0].object];
			switch (susan.indexOf(intersects[0].object)){
				case 4:
					outlinePass.selectedObjects.push(susan[5]) // plane body
					break;
				case 5:
					outlinePass.selectedObjects.push(susan[4]) // plane body
					break;
			}
			
		//}
	} else { // if there is nothing highlighted on the model, it's the sky.
		outlinePass.selectedObjects = [];
	}
}

/* --------------------------------------------------------------------------------------------------------------------- */
/* --------------------------------------------------- MOUSE CLICKS ---------------------------------------------------- */
/* --------------------------------------------------------------------------------------------------------------------- */

// when a part of the scene is clicked
function onMouseClick(event) {
	clickedPass.selectedObjects = [];
	// if it's on the battery settings then the model is invisible, and we don't want clicks or highlights to happen
	if (!settings['Electrical System:']){
		if (intersects.length > 0) { // if the model has been clicked and not the sky	

			clickedPass.selectedObjects = [intersects[0].object]; // save which part has been clicked
			switch (susan.indexOf(intersects[0].object)){
				case 4:
					clickedPass.selectedObjects.push(susan[5]) // tail
					break;
				case 5:
					clickedPass.selectedObjects.push(susan[4]) // tail
					break;
			}

			// get that nice info and title action
			let ind = susan.indexOf(intersects[0].object);
			parttitle = parttitlelist[ind];
			partinfo = partinfolist[ind];	

			// now zooooooom -- can be laggy if processor is working too hard, but you can turn it off in the GUI
			//disable zoomin if wiremodel is showing, reenable if already true before
			if (zoomin) zoomintopart(ind);

		} else {
			// the sky has been clicked so void it out
			parttitle = parttitlelist[parttitlelist.length - 1];
			partinfo = partinfolist[partinfolist.length - 1];
		}
	}
	// Set the info to something different without changing the current display
	showInfo(settings['Show Info']);
}


/* --------------------------------------------------------------------------------------------------------------------- */
/* -------------------------------------------------------- GUI -------------------------------------------------------- */
/* --------------------------------------------------------------------------------------------------------------------- */
//https://github.com/mrdoob/three.js/blob/master/examples/webgl_animation_skinning_blending.html
function createPanel() {
	panel = new GUI({ 
		title: "Settings",
		width: 200
	});
	panel.domElement.id = 'gui';
	
	settings = {
		'Electrical System:': false, // start with SUSAN model showing. To edit further when adding more models
		'Recenter Camera': resetCam, //necessary, resets camera back to reload init settings
		'Show Info': true, // show or hide the fancy flavor text
		'Zoom into Parts': zoomin, // zoom to fit the part when clicked
		'x': zoomscreen.x, // if someone's trackpad isn't working or they just want to adjust the angle manually
		'y': zoomscreen.y,
		'z': zoomscreen.z
	};

	panel.add(settings, 'Electrical System:').onChange(showModel);
	panel.add(settings, 'Show Info').onChange(showInfo);
	panel.add(settings, 'Zoom into Parts').onChange(function(){zoomin = !zoomin});
	panel.add(settings, 'Recenter Camera');
	// use trig for camera max settings? Nah just big numbers and brute force on the camera limits will do the rest
	// goodness I love coding
	const coords = panel.addFolder( 'Cartesian Coordinates');
	xcontroller = coords.add(settings, 'x', -100, 100).listen().onChange( function(xpos){changeXCam(xpos);});
	ycontroller = coords.add(settings, 'y', -100, 100).listen().onChange( function(ypos){changeYCam(ypos);});
	zcontroller = coords.add(settings, 'z', -100, 100).listen().onChange( function(zpos){changeZCam(zpos);});
	// I actually tried tons of different textures, materials, colors, and even highlights, but nothing works as well as
	// the colors I had originally chosen anyway
	//colorbl = panel.add(settings, 'colorblind mode', {'normal':'normal', 'protanopia':'protanopia', 'deuteranopia':'deuteranopia','tritanopia':'tritanopia'}).onChange(function(event) {colormodechange(event)});
	coords.close(); // keep ugly coordinate folder closed
}

// show or hide model -- may be edited to include other model
function showModel(visibility) {
	
	if (visibility){
		parttitle = parttitlelist[0]; // the wire/engine model
		partinfo = partinfolist[0];
	} else {
		parttitle = parttitlelist[parttitlelist.length - 1]; // the default sky
		partinfo = partinfolist[partinfolist.length - 1];
	}
	showInfo(settings['Show Info']);

	planemodel.visible = visibility;
	susan[0].visible = visibility;
	for (let i = 1; i < susan.length; i++)
		if (i!=3 && i!=8) susan[i].visible = !visibility; // keep in the wires, electric engines, turbo engine
}

// show or hide floating text
function showInfo(clicked) {
	document.getElementById("infotitle").innerHTML = "<h1>"+ parttitle + "</h1>";
	document.getElementById("partinfo").innerHTML = "<p>"+ partinfo + "</p>";
	if (clicked) {
		document.getElementById("infotitle").style.display = "block";
		document.getElementById("partinfo").style.display = "block";
	} else {
		document.getElementById("infotitle").style.display = "none";
		document.getElementById("partinfo").style.display = "none";
	}
}

//https://discourse.threejs.org/t/camera-zoom-to-fit-object/936/2
// reset the camera
function resetCam() {
	if (!zoomin) {
		camera.position.set(zoomscreen.x, zoomscreen.y, zoomscreen.z);
		camera.lookAt(0, 0, 0);
		// controls.target.set(0, 0, 0); // look at 0,0,0
		// controls.update(); // update the controls
	} else {
		zoomintopart(partcoordinatelist.length-1);
	}
}

//changes the x-value position. Goes around the plane model thanks to camera bounding.
function changeXCam(xpos){
	var viewPos = camera.position;
	var newView = new THREE.Vector3();
	newView.copy(viewPos);
	camera.position.set(xpos, newView.y, newView.z); // get the direction, positive or negative
	camera.lookAt(0, 0, 0);
}

//changes the y-value position. Goes around the plane model thanks to camera bounding.
function changeYCam(ypos){
	var viewPos = camera.position;
	var newView = new THREE.Vector3();
	newView.copy(viewPos);
	camera.position.set(newView.x, ypos, newView.z); // get the direction, positive or negative
	camera.lookAt(0, 0, 0);
}

//changes the z-value position. Goes around the plane model thanks to camera bounding.
function changeZCam(zpos){
	var viewPos = camera.position;
	var newView = new THREE.Vector3();
	newView.copy(viewPos);
	camera.position.set(newView.x, newView.y, zpos); // get the direction, positive or negative
	camera.lookAt(0, 0, 0);
}

// https://github.com/mrdoob/three.js/blob/master/examples/webgl_decals.html
// hehehe
function removeDecals() {
	decals.forEach(function (d) {
		scene.remove(d);
	});
	decals.length = 0;
}

// zoom into clicked part, ind is index of part in the list
// YESS IT BE ZOOMIN'
function zoomintopart(ind){
	// some magic that gets the current camera position without bugs
	var viewPos = camera.position;
	var op = new THREE.Vector3();
	op.copy(viewPos);
	// the interval of steps to get to position, the neutral position
	let interval = new THREE.Vector3((partcoordinatelist[ind].x - op.x)/100, (partcoordinatelist[ind].y - op.y)/100, (partcoordinatelist[ind].z - op.z)/100);
	
	//Copied from fade(element) in the setup! Changed to accomodate Vector3
	let timer = setInterval(function () {
		if (op.x - partcoordinatelist[ind].x <= 5 && op.y - partcoordinatelist[ind].y <= 5 && op.z - partcoordinatelist[ind].z <= 5){ // within 10 of the desired position
			clearInterval(timer);
			camera.position.set(partcoordinatelist[ind].x, partcoordinatelist[ind].y, partcoordinatelist[ind].z)
		}
		camera.position.set(op.x, op.y, op.z)
		op.x = op.x + interval.x; // change the position
		op.y = op.y + interval.y;
		op.z = op.z + interval.z;
		camera.lookAt(0, 0, 0);
	}, 10); // ms per frame
}

/* --------------------------------------------------------------------------------------------------------------------- */
/* ------------------------------------------------ ANIMATE AND RENDER ------------------------------------------------- */
/* --------------------------------------------------------------------------------------------------------------------- */
// update the information shown on the screen
function animate() {
	requestAnimationFrame(animate);
	nodeFrame.update();
	controls.update(); // required if damping enabled
	
	////////////// render the scene
	camera.aspect = windowwidth / windowheight;
	camera.updateProjectionMatrix();
	// gets the current camera position
	var viewPos = camera.position;
	var newView = new THREE.Vector3();
	newView.copy(viewPos);
	// updates the controllers
	if (xcontroller) {xcontroller.setValue(newView.x); xcontroller.updateDisplay();}
	if (ycontroller) {ycontroller.setValue(newView.y); ycontroller.updateDisplay();}
	if (zcontroller) {zcontroller.setValue(newView.z); zcontroller.updateDisplay();}
	renderer.render(scene, camera);
	composer.render();
	////////////// //////////////
	
}