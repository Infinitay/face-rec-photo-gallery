// import nodejs bindings to native tensorflow,
// not required, but will speed up things drastically (python required)
const tf = require('@tensorflow/tfjs-node');
// implements nodejs wrappers for HTMLCanvasElement, HTMLImageElement, ImageData
const canvas = require('canvas');

const faceapi = require('face-api.js');

// patch nodejs environment, we need to provide an implementation of
// HTMLCanvasElement and HTMLImageElement, additionally an implementation
// of ImageData is required, in case you want to use the MTCNN
const {
	Canvas,
	Image,
	ImageData,
	Video
} = canvas;
faceapi.env.monkeyPatch({
	Canvas: HTMLCanvasElement,
	Image: HTMLImageElement,
	ImageData: ImageData,
	Video: HTMLVideoElement,
	createCanvasElement: () => document.createElement('canvas'),
	createImageElement: () => document.createElement('img')
});
// https://github.com/justadudewhohacks/face-api.js/issues/157#issuecomment-443507577

const fs = require('fs');
const path = require('path');
let faceMatcher;

Promise.all([
	faceapi.nets.faceRecognitionNet.loadFromUri('./assets/models'),
	faceapi.nets.faceLandmark68Net.loadFromUri('./assets/models'),
	faceapi.nets.ssdMobilenetv1.loadFromUri('./assets/models')
]).then(async () => {
	const bd = document.getElementById('building-database');
	bd.innerHTML = "Models are done loading.";
	console.log("Models are done loading.");
	bd.innerHTML = "Building database...";
	const labeledFaceDescriptors = await buildDatabase();
	bd.innerHTML = "Database is finished building.";
	bd.remove();
	console.log("Database is finished building.");
	console.log(labeledFaceDescriptors);
	// The lower the threshold the better
	faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
});

async function detectFaces(img) {
	const photoView = document.getElementById('photo-view');
	const displaySize = {
		width: img.width,
		height: img.height
	};

	const overlay = await faceapi.createCanvasFromMedia(img);
	overlay.setAttribute('id', 'face-rec-overlay');
	photoView.appendChild(overlay);
	const detectedFaces = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
	faceapi.matchDimensions(overlay, img);
	const resizedDetectedFaces = faceapi.resizeResults(detectedFaces, displaySize);
	const recognizedFaces = resizedDetectedFaces.map(detectedFace => faceMatcher.findBestMatch(detectedFace.descriptor));
	console.log(`Detected Faces: ${detectedFaces.length}\nResized Faces: ${resizedDetectedFaces.length}\nRecognized Faces: ${recognizedFaces.length}`);
	recognizedFaces.forEach((recFace, recFaceIndex) => {
		const box = resizedDetectedFaces[recFaceIndex].detection.box;
		const drawBox = new faceapi.draw.DrawBox(box, {
			label: recFace.toString(),
		});
		drawBox.draw(overlay);
	});
}

function buildDatabase() {
	console.log("Building database...");
	const dataSetLocation = './assets/test-data-set';
	const subjects = fs.readdirSync(dataSetLocation);

	return Promise.all(
		subjects.map(async subject => {
			const descriptions = [];
			for (const photo of fs.readdirSync(path.join(dataSetLocation, subject))) {
				const img = await faceapi.fetchImage(path.join(dataSetLocation, subject, photo));
				console.log(`Building data from ${path.join(dataSetLocation, subject, photo)}`);
				const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
				descriptions.push(detections.descriptor);
			}
			console.log(`Finished building descriptions for ${subject}`);
			console.log(descriptions);
			return new faceapi.LabeledFaceDescriptors(subject, descriptions);
		}));
}

module.exports = {
	detectFaces: detectFaces
};