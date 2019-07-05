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

for (const photo of photos) {
	const img = document.createElement('img');
	img.src = path.format(photo);
	img.id = 'photo-preview';
	img.title = path.join(photo.name, photo.ext);
	img.addEventListener('click', event => updateMainPhoto(event));
	photoReel.appendChild(img);
}

function updateMainPhoto(imgElement) {
	const photo = path.parse(imgElement.target.src);

	const img = document.createElement('img');
	img.src = path.format(photo);
	img.id = 'photo';
	img.title = path.join(photo.name, photo.ext);

	const photoView = document.getElementById('photo-view');
	photoView.innerHTML = '';
	photoView.appendChild(img);
}