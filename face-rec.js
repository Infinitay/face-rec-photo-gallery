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

const utils = require('./my-utils.js');
const fs = require('fs');
const path = require('path');
const {
	ipcRenderer,
	remote
} = require('electron');

const bd = document.getElementById('building-database');
const DB_PATH = `./assets/LBF Database.json`;
const COMPRESSED_DB_PATH = `./assets/LBF Database.json.gz`;
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
	faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.7);
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
/**
 * TODO
 * Don't rebuild the entire database, instead build on need-by-need basis
 * if subject A folder is modified, rebuild that and place it back into the db
 * that way lots of resources won't be utilized and the time for rebuilding would decrease
 *
 * Properly handle get-data-set-directory where it returns an array of paths instead of one path
 *
 * Make sure line 130 checks if its a directory
 */
// Labeled Face Descriptor I/O: https://github.com/justadudewhohacks/face-api.js/pull/397#issuecomment-526847142
async function fetchDatabase() {
	faceRecLogger("Loading database...");
	const dataSetLocation = ipcRenderer.sendSync('get-data-set-directory') ? ipcRenderer.sendSync('get-data-set-directory')[0] : './assets/test-data-set';
	const dataSetLastModified = utils.getNestedLastModifiedDateSync(dataSetLocation);
	// TODO: THROW ERROR IF THERE IS NOT NESTED FOLDERS BECAUSE THERE HAS TO BE FOR DATASETLOCATION!
	if (fs.existsSync(COMPRESSED_DB_PATH)) {
		// lbfDatabase file structure -> json file
		/**
		 * {
		 *	"lastModified": epoch in ms (BigInt),
		 *	"labeledFaceDescriptors": [Array (Labeled Face Descriptors)]
		 * }
		 */
		const lbfDatabase = await utils.decompressDatabaseToJSON();
		console.log(`Found existing database file, last modified on: ${new Date(lbfDatabase.lastModified).toLocaleString()}.`);
		if (lbfDatabase.lastModified == dataSetLastModified) {
			faceRecLogger("Loading existing database...");
			const shouldRebuildDatabase = remote.dialog.showMessageBoxSync({
				'title': `${ipcRenderer.sendSync('get-window-title')} - Database`,
				'message': `Found existing database file, last modified on: ${new Date(lbfDatabase.lastModified).toLocaleString()}. Would you like to use this prebuilt database? If not, the database will be rebuilt and overwritten.`,
				'buttons': ['Use Existing Database', 'Rebuild Database'] // returns 0, 1
			});
			if (!shouldRebuildDatabase) {
				return lbfDatabase.labeledFaceDescriptors.map(x => faceapi.LabeledFaceDescriptors.fromJSON(x));
			} else {
				faceRecLogger("Existing database is out-of-date, re-building database...");
				return await buildDatabase(dataSetLocation, dataSetLastModified);
			}
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
	await utils.compressDatabaseFromJSON(databaseJSON);
	faceRecLogger("Successfully built the database.");
	return labeledFaceDescriptors;
}

function buildLabeledFaceDescriptors(dataSetLocation) {
	console.log("Building labeled face descriptors...");
	const subjects = fs.readdirSync(dataSetLocation).filter(subject => fs.readdirSync(path.join(dataSetLocation, subject)).length);

	return Promise.all(
		subjects.map(async subject => {
			const descriptions = [];
			let count = 1;
			const subjectDir = fs.readdirSync(path.join(dataSetLocation, subject));
			for (const photo of subjectDir) {
				const img = await faceapi.fetchImage(path.join(dataSetLocation, subject, photo));
				console.log(`Building data from ${path.join(dataSetLocation, subject, photo)} [${count++}/${subjectDir.length}]`);
				try {
					const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
					descriptions.push(detections.descriptor);
				} catch (error) {
					console.warn(`Couldn't build descriptor from ${path.join(dataSetLocation, subject, photo)}!`);
					console.warn(error);
				}
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

module.exports = {
	detectFaces: detectFaces
};