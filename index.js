const {
	ipcRenderer
} = require('electron');

const photosUtil = require('./photos');
const faceUtil = require('./face-rec');
const path = require('path');

const dir = ipcRenderer.sendSync('get-photo-directory');
console.log(dir);
const photos = photosUtil.getPhotos(dir);
console.log(photos);

const photoReel = document.getElementById('photo-reel');
photoReel.innerHTML = '';

for (const photo of photos) {
	const img = document.createElement('img');
	img.src = path.format(photo);
	img.id = 'photo-preview';
	img.title = decodeURI(photo.name); // remove %20 for spaces
	img.addEventListener('click', () => updateMainPhoto(path.format(photo)));
	photoReel.appendChild(img);

	if (photo !== photos[photos.length]) {
		const hr = document.createElement('hr');
		hr.className = 'divider';
		photoReel.appendChild(hr);
	}
}

function updateMainPhoto(imgPath) {
	const photo = path.parse(imgPath);

	const img = document.createElement('img');
	img.src = imgPath;
	img.id = 'photo';
	img.title = decodeURI(photo.name); // remove %20 for spaces

	const photoView = document.getElementById('photo-view');
	photoView.innerHTML = '';
	photoView.appendChild(img);

	document.title = `Face API Testing - ${img.title}`;

	img.onload = () => {
		faceUtil.detectFaces(img).then(() => {
			console.log(`Done updating main photo and detecting face(s)!`);
		});
	};
}