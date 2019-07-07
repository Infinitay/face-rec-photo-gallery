/* const photoReel = document.getElementById('photo-reel');
	for (let x = 0; x < 100; x++) {
		const bullet = document.createElement('li')
		bullet.id = 'photo-preview'
		bullet.appendChild(document.createTextNode(`${x + 1}`))
		photoReel.appendChild(bullet)
	} */

const {
	ipcRenderer
} = require('electron');

const photosUtil = require('./photos');
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
	img.addEventListener('click', event => updateMainPhoto(event));
	photoReel.appendChild(img);

	if (photo !== photos[photos.length]) {
		const hr = document.createElement('hr');
		hr.className = 'divider';
		photoReel.appendChild(hr);
	}
}

function updateMainPhoto(imgElement) {
	const photo = path.parse(imgElement.target.src);

	const img = document.createElement('img');
	img.src = path.format(photo);
	img.id = 'photo';
	img.title = decodeURI(photo.name); // remove %20 for spaces

	const photoView = document.getElementById('photo-view');
	photoView.innerHTML = '';
	photoView.appendChild(img);

	document.title = `Face API Testing - ${img.title}`;
}