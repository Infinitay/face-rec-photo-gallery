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
const {
	ipcRenderer
} = require('electron');
const bd = document.getElementById('building-database');
const DATABASE_PATH = `./assets/LBF Database.json`;
let faceMatcher;

faceRecLogger("Loading models...");

Promise.all([
	faceapi.nets.faceRecognitionNet.loadFromDisk('./assets/models'),
	faceapi.nets.faceLandmark68Net.loadFromDisk('./assets/models'),
	faceapi.nets.ssdMobilenetv1.loadFromDisk('./assets/models')
]).then(async () => {
	faceRecLogger("Successfully loaded models.");
	const labeledFaceDescriptors = await fetchDatabase();
	faceRecLogger("Successfully loaded database.");
	bd.remove();
	// The lower the threshold the better
	faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
});

async function detectFaces(img) {
	const photoView = document.getElementById('photo-view');
	const displaySize = {
		width: img.width,
		height: img.height
	};

	const overlay = faceapi.createCanvasFromMedia(img);
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
			label: recFace.toString()
		});
		drawBox.draw(overlay);
	});
}

// Labeled Face Descriptor I/O: https://github.com/justadudewhohacks/face-api.js/pull/397#issuecomment-526847142
async function fetchDatabase() {
	faceRecLogger("Loading database...");
	const dataSetLocation = ipcRenderer.send('get-data-set-directory') ? ipcRenderer.send('get-data-set-directory') : './assets/test-data-set';
	const dataSetLastModified = getLastModifiedDateSync(dataSetLocation);
	if (fs.existsSync(DATABASE_PATH)) {
		// lbfDatabase file structure -> json file
		/**
		 * {
		 *	"lastModified": epoch in ms (BigInt),
		 *	"labeledFaceDescriptors": [Array (Labeled Face Descriptors)]
		 * }
		 */
		const lbfDatabase = JSON.parse(fs.readFileSync(DATABASE_PATH));
		console.log(`Found existing database file, last modified on: ${new Date(lbfDatabase.lastModified).toLocaleString()}.`);
		if (lbfDatabase.lastModified == dataSetLastModified) {
			faceRecLogger("Loading existing database...");
			return lbfDatabase.labeledFaceDescriptors.map(x => faceapi.LabeledFaceDescriptors.fromJSON(x));
		} else {
			faceRecLogger("Existing database is out-of-date, re-building database...");
			return await buildDatabase(dataSetLocation, dataSetLastModified);
		}
	} else {
		faceRecLogger("Building database...");
		return await buildDatabase(dataSetLocation, dataSetLastModified);
	}
}

async function buildDatabase(dataSetLocation, dataSetLastModified) {
	const labeledFaceDescriptors = await buildLabeledFaceDescriptors(dataSetLocation);
	const labeledFaceDescriptorsJSON = labeledFaceDescriptors.map(x => x.toJSON());
	const databaseJSON = {
		lastModified: dataSetLastModified,
		labeledFaceDescriptors: labeledFaceDescriptorsJSON
	};
	fs.writeFileSync(DATABASE_PATH, JSON.stringify(databaseJSON, null, 4));
	faceRecLogger("Successfully built the database.");
	return labeledFaceDescriptors;
}

function buildLabeledFaceDescriptors(dataSetLocation) {
	console.log("Building labeled face descriptors...");
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

function faceRecLogger(log) {
	bd.innerHTML = log;
	console.log(log);
}

function getLastModifiedDateSync(_path) {
	return fs.statSync(_path).mtimeMs;
}

module.exports = {
	detectFaces: detectFaces
};