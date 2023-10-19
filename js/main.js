let gba;
			let runCommands = [];
			let debug = null;

			try {
				gba = new GameBoyAdvance();
				gba.keypad.eatInput = true;
				gba.setLogger(function (level, error) {
					console.log(error);
					gba.pause();
					let screen = document.getElementById('screen');
					if (screen.getAttribute('class') === 'dead') {
						console.log(
							'We appear to have crashed multiple times without reseting.'
						);
						return;
					}
					crash.setAttribute('id', 'crash');
					screen.parentElement.insertBefore(screen, crash);
					screen.setAttribute('class', 'dead');
				});
			} catch (exception) {
				gba = null;
			}

			window.onload = function () {
				if (gba && FileReader) {
					let canvas = document.getElementById('screen');
					gba.setCanvas(canvas);

					gba.logLevel = gba.LOG_ERROR;

					gba.setBios(biosBin);

					if (!gba.audio.context) {
						// Remove the sound box if sound isn't available
						let soundbox = document.getElementById('sound');
						soundbox.parentElement.removeChild(soundbox);
					}

					if (
						window.navigator.appName ===
						'Microsoft Internet Explorer'
					) {
						// Remove the pixelated option if it doesn't work
						let pixelatedBox = document.getElementById('pixelated');
						pixelatedBox.parentElement.removeChild(pixelatedBox);
					}
				} else {
					let dead = document.getElementById('controls');
					dead.parentElement.removeChild(dead);
				}
			};

			function fadeOut(id, nextId, kill) {
				let e = document.getElementById(id);
				let e2 = document.getElementById(nextId);
				if (!e) {
					return;
				}
				let removeSelf = function () {
					if (kill) {
						e.parentElement.removeChild(e);
					} else {
						e.setAttribute('class', 'dead');
						e.removeEventListener(
							'webkitTransitionEnd',
							removeSelf
						);
						e.removeEventListener('oTransitionEnd', removeSelf);
						e.removeEventListener('transitionend', removeSelf);
					}
					if (e2) {
						e2.setAttribute('class', 'hidden');
						setTimeout(function () {
							e2.removeAttribute('class');
						}, 0);
					}
				};

				e.addEventListener('webkitTransitionEnd', removeSelf, false);
				e.addEventListener('oTransitionEnd', removeSelf, false);
				e.addEventListener('transitionend', removeSelf, false);
				e.setAttribute('class', 'hidden');
			}

			function run(file) {
				let dead = document.getElementById('loader');
				dead.value = '';
				let load = document.getElementById('select');
				load.textContent = 'Cargando...';
				load.removeAttribute('onclick');
				let pause = document.getElementById('pause');
				pause.textContent = 'Pausa';
				gba.loadRomFromFile(file, function (result) {
					if (result) {
						for (let i = 0; i < runCommands.length; ++i) {
							runCommands[i]();
						}
						runCommands = [];
						fadeOut('preload', 'ingame');
						fadeOut('instructions', null, true);
						gba.runStable();
					} else {
						load.textContent = 'Error';
						setTimeout(function () {
							load.textContent = 'SELECIONAR';
							load.onclick = function () {
								document.getElementById('loader').click();
							};
						}, 3000);
					}
				});
			}

			function reset() {
				gba.pause();
				gba.reset();
				let load = document.getElementById('select');
				load.textContent = 'Seleccionar';
				let crash = document.getElementById('crash');
				if (crash) {
					let context = gba.targetCanvas.getContext('2d');
					context.clearRect(0, 0, 480, 320);
					gba.video.drawCallback();
					crash.parentElement.removeChild(crash);
					let canvas = document.getElementById('screen');
					canvas.removeAttribute('class');
				} else {
					lcdFade(
						gba.context,
						gba.targetCanvas.getContext('2d'),
						gba.video.drawCallback
					);
				}
				load.onclick = function () {
					document.getElementById('loader').click();
				};
				fadeOut('ingame', 'preload');
			}

			function uploadSavedataPending(file) {
				runCommands.push(function () {
					gba.loadSavedataFromFile(file);
				});
			}

			function togglePause() {
				let e = document.getElementById('pause');
				if (gba.paused) {
					if (debug && debug.gbaCon) {
						debug.gbaCon.run();
					} else {
						gba.runStable();
					}
					e.textContent = 'Pausa';
				} else {
					if (debug && debug.gbaCon) {
						debug.gbaCon.pause();
					} else {
						gba.pause();
					}
					e.textContent = 'Reanudar';
				}
			}

			function screenshot() {
				let canvas = gba.indirectCanvas;
				let data = canvas.toDataURL('image/png');
				let image = new Image();
        image.src = data;
        let w = window.open("");
        w.document.write(image.outerHTML);
			}

			function lcdFade(context, target, callback) {
				let i = 0;
				let drawInterval = setInterval(function () {
					i++;
					let pixelData = context.getImageData(0, 0, 240, 160);
					for (let y = 0; y < 160; ++y) {
						for (let x = 0; x < 240; ++x) {
							let xDiff = Math.abs(x - 120);
							let yDiff = Math.abs(y - 80) * 0.8;
							let xFactor = (120 - i - xDiff) / 120;
							let yFactor =
								(80 -
									i -
									(y & 1) * 10 -
									yDiff +
									Math.pow(xDiff, 1 / 2)) /
								80;
							pixelData.data[(x + y * 240) * 4 + 3] *=
								Math.pow(xFactor, 1 / 3) *
								Math.pow(yFactor, 1 / 2);
						}
					}
					context.putImageData(pixelData, 0, 0);
					target.clearRect(0, 0, 480, 320);
					if (i > 40) {
						clearInterval(drawInterval);
					} else {
						callback();
					}
				}, 50);
			}

			function setVolume(value) {
				gba.audio.masterVolume = Math.pow(2, value) - 1;
			}

			function setPixelated(pixelated) {
				let screen = document.getElementById('screen');
				let context = screen.getContext('2d');
				context.imageSmoothingEnabled = !pixelated;
			}

			function enableDebug() {
				window.onmessage = function (message) {
					if (
						message.origin != document.domain &&
						(message.origin != 'file://' || document.domain)
					) {
						console.log('Failed XSS');
						return;
					}
					switch (message.data) {
						case 'connect':
							if (message.source === debug) {
								debug.postMessage(
									'connect',
									document.domain || '*'
								);
							}
							break;
						case 'connected':
							break;
						case 'disconnect':
							if (message.source === debug) {
								debug = null;
							}
					}
				};
				window.onunload = function () {
					if (debug && debug.postMessage) {
						debug.postMessage('disconnect', document.domain || '*');
					}
				};
				if (!debug || !debug.postMessage) {
					debug = window.open('debugger.html', 'debug');
				} else {
					debug.postMessage('connect', document.domain || '*');
				}
			}

			document.addEventListener(
				'webkitfullscreenchange',
				function () {
					let canvas = document.getElementById('screen');
					if (document.webkitIsFullScreen) {
						canvas.setAttribute(
							'height',
							document.body.offsetHeight
						);
						canvas.setAttribute(
							'width',
							(document.body.offsetHeight / 2) * 3
						);
						canvas.setAttribute('style', 'margin: 0');
					} else {
						canvas.setAttribute('height', 320);
						canvas.setAttribute('width', 480);
						canvas.removeAttribute('style');
					}
				},
				false
			);

			const fullScreen = () => {
				document.getElementById('screen').requestFullscreen();
			};