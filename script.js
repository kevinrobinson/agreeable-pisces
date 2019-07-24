var tmImage = window.tmImage;
var _ = window._;
var clipboard = window.clipboard;


async function main() {
  const outEl = document.querySelector('.TileTwo');

  // init from query string
  const queryString = window.location.search;
  if (queryString.indexOf('?model=') === 0) {
    const modelKey = queryString.slice(6).replace(/[^a-zA-Z0-9]/g,'');
    document.querySelector('#model-key').value = modelKey;
    initForModelKey(outEl, modelKey);
  }
  
  // handler for loading model
  document.querySelector('#model-button').addEventListener('click', e => {
    const modelKey = document.querySelector('#model-key').value;
    initForModelKey(outEl, modelKey);
  });

  // dump out predictions
  document.querySelector('#load-dump-json').addEventListener('change', async function(event) {
    const files = await readInputFilesAsText(event.target.files);
    const items = JSON.parse(files[0]);
    const predictionsCount = _.uniq(_.flatMap(items, item => item.prediction.map(p => p.className)));
    renderItems(outEl, predictionsCount, items);
  });
}

async function loadModel(modelKey) {
  // the json file (model topology) has a reference to the bin file (model weights)
  const checkpointURL = `https://storage.googleapis.com/tm-mobilenet/${modelKey}/model.json`;
  // the metatadata json file contains the text labels of your model and additional information
  const metadataURL = `https://storage.googleapis.com/tm-mobilenet/${modelKey}/metadata.json`;

  // load the model and metadata
  const model = await tmImage.mobilenet.load(checkpointURL, metadataURL);
  const maxPredictions = model.getTotalClasses();
  return {model, maxPredictions};
}


async function init(outEl, model, maxPredictions) {  
  document.querySelector('#dump').disabled = 'disabled';
  
  // state across changes to dataset
  var items = [];
  
  // load images
  document.querySelector('#file-selector').addEventListener('change', async function(event) {
    const files = await readInputFilesAsDataURL(event.target.files);
    console.log('  loaded files:', files.length);
    
    // predict
    for (var i = 0; i < files.length; i++) {
      const {prediction} = await predictForUri(model, maxPredictions, files[i].uri);
      items.push({
        source: 'disk',
        prediction,
        uri: files[i].uri,
        filename: files[i].filename,
        filenameLabel: guessFilenameLabel(files[i].filename)
      });
    }

    // render
    renderItems(outEl, maxPredictions, items);
  });
  
  // search
  document.querySelector('#search-button').addEventListener('click', async function(e) {
    const query = prompt('Search for:');
    if (!query) return;
    
    const json = await fetchJson(query, 'abc');
    const uris = (json.items || []).map(item => item.image.thumbnailLink);
    // const uris = (json.items || []).map(item => item.link);
    console.log(' search results:', uris.length);

    // predict
    for (var i = 0; i < uris.length; i++) {
      const {prediction} = await predictForUri(model, maxPredictions, uris[i]);
      items.push({
        source: 'search',
        prediction,
        query,
        uri: uris[i]
      });
    }

    // render
    renderItems(outEl, maxPredictions, augmented(items));
  });
  
  
  // webcam
  var webcamEl = null;
  document.querySelector('#webcam-button').addEventListener('click', async function(e) {
    if (webcamEl) {
      webcamEl.captureStream().getTracks().forEach(track => track.stop());
      webcamEl.parentElement.removeChild(webcamEl);
      webcamEl = null;
      return;
    }
    
    webcamEl = await startWebcam(outEl);
    var startTimestamp = (new Date()).getTime();
    
    // loop
    const WEBCAM_SNAP_INTERVAL = 1000;
    async function tick() {
      // snapshot and predict
      const {prediction, uri} = await readAndPredictFromWebcam(webcamEl, model, maxPredictions);
      const timestamp = (new Date()).getTime();
      items.push({
        source: 'webcam',
        camera: true,
        prediction,
        uri,
        timestamp,
        elapsedSeconds: Math.round((timestamp - startTimestamp)/1000/60)
      });
      
      // render
      renderItems(outEl, maxPredictions, augmented(items));
      if (webcamEl) setTimeout(tick, WEBCAM_SNAP_INTERVAL);
    }
    tick();
  });
}


async function predictForUri(model, maxPredictions, uri) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = async function() {
      const prediction = await model.predict(img, false, maxPredictions);
      resolve({prediction, uri});
    };
    img.crossOrigin = "Anonymous"; // allow images from search to be read by model
    img.src = uri;
  });
}


// items [{prediction, uri}]
function renderItems(targetEl, maxPredictions, items) {
  const facetsEl = targetEl.querySelector('.Facets');
  facets(facetsEl, items);
  allowDump(targetEl, items);
}

function allowDump(outEl, items) {
  document.querySelector('#dump').disabled = false;
  document.querySelector('#dump').addEventListener('click', function(e) {
    var dt = new clipboard.DT();
    dt.setData("text/plain", JSON.stringify(items));
    clipboard.write(dt);
    console.log(JSON.stringify(items));
    download('data:application/json,' + JSON.stringify(items), 'analysis.json');
  })
}

// eg 'english_setter_2.jpg'
function guessFilenameLabel(filename) {
  return filename.split(/[\._]/).slice(0, -1).filter(s => !s.match(/\d+/)).join('_');
}



// webcam
async function startWebcam(outEl) {
  // webcam has a square ratio and is flipped by default to match training
  const webcamFlipped = true;
  const webcamEl = await tmImage.getWebcam(200, 200, 'front', webcamFlipped);
  webcamEl.play();
  outEl.appendChild(webcamEl);
  return webcamEl;
}

async function readAndPredictFromWebcam(webcamEl, model, maxPredictions) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.drawImage(webcamEl, 0, 0, 200, 200);
  // document.body.appendChild(canvas);
  const prediction = await model.predict(canvas, false, maxPredictions);
  const uri = canvas.toDataURL();
  return {prediction, uri};
}

  
//   // predict can take in an image, video or canvas html element
//     // we set flip to true since the webcam was only flipped in CSS
//     const flip = true;
    // const prediction = await model.predict(webcamEl, flip, maxPredictions);
//     return prediction;
// }


// facets
function textLabelForClassName(className) {
  return `${className} score`;
}

async function facets(targetEl, items) {
  // flatten data, round numbers for UX
  const facetsData = items.map(function(item, i) {
    const classification = _.maxBy(item.prediction, 'probability').className;
    const labels = item.prediction.reduce((map, p) => {
      return {
        ...map,
        [textLabelForClassName(p.className)]: parseFloat(p.probability.toFixed(4))
      };
    }, {});
    return {
      i,
      classification,
      hashedURI: hash64(item.uri),
      source: item.source || 'uknown',
      filename: item.filename || 'none',
      filenameLabel: item.filenameLabel || 'none',
      searchQuery: item.query || 'none',
      elapsedSeconds: item.elapsedSeconds || 'none',
      ...labels
    };
  });
  const classNames = _.uniq(_.flatMap(items, item => item.prediction.map(p => p.className)));

  // create or grab the polymer el
  var facetsDiveEl = targetEl.querySelector('facets-dive');
  var didCreate = false;
  if (!facetsDiveEl) {
    const el = document.createElement('div');
    el.innerHTML = '<facets-dive width="100%" height="600" />';
    targetEl.appendChild(el);
    facetsDiveEl = targetEl.querySelector('facets-dive');
    didCreate = true;
  }

  // the order of these calls matters
  // only set defaults; otherwise let user interactions stick through renders
  facetsDiveEl.data = facetsData;
  facetsDiveEl.infoRenderer = facetsInfoRenderer.bind(null, items);
  if (didCreate) {
    facetsDiveEl.hideInfoCard = false;
    facetsDiveEl.verticalFacet = textLabelForClassName(classNames[0]);
    facetsDiveEl.verticalBuckets = 4;
    facetsDiveEl.horizontalFacet = 'searchQuery';
    // facetsDiveEl.tweenDuration = 0;
    // facetsDiveEl.fadeDuration = 0;
  }
  
  // sprite sheet
  // see https://github.com/PAIR-code/facets/tree/master/facets_dive#providing-sprites-for-dive-to-render
  // 64x64 is the assumption
  const {canvas, uri} = await createFacetsAtlas(items, 64, 64);
  // console.log('uri', uri);
  // document.body.appendChild(canvas);
  facetsDiveEl.atlasUrl = uri;
  facetsDiveEl.spriteImageWidth = 64;
  facetsDiveEl.spriteImageHeight = 64;
}

async function createFacetsAtlas(items, width, height) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  const cols = Math.ceil(Math.sqrt(items.length));
  canvas.width = cols * width;
  canvas.height = cols * width;
  await Promise.all(items.map((item, index) => {
    const x = width * (index % cols);
    const y = height * Math.floor(index / cols);
    const img = new Image();
    return new Promise(function(resolve, reject) {
      img.onload = function() {
        context.drawImage(img, x, y, width, height);
        resolve();
      };
      img.crossOrigin = 'Anonymous'; // allow images from search
      img.src = item.uri;
    });
  }));
  
  const uri = canvas.toDataURL();
  return {canvas, uri};
}

// see https://github.com/PAIR-code/facets/blob/967e764dd8fbc8327ba9d4e39f3c0d76dce834b9/facets_dive/lib/info-renderers.ts#L26
function facetsInfoRenderer(items, selectedObject, elem) {
  // copied
  const dl = document.createElement('dl');
  
  // inserted
  const item = _.find(items, item => hash64(item.uri) === selectedObject.hashedURI);
  if (item) {
    const img = document.createElement('img');
    img.crossOrigin = 'Anonymous';
    img.src = item.uri;
    img.style.width = '100%';
    dl.appendChild(img);
  }
  
  // copied
  for (const field in selectedObject) {
    // modified
    if (field )
    if (!selectedObject.hasOwnProperty(field)) {
      continue;
    }
    const dt = document.createElement('dt');
    dt.textContent = field;
    dl.appendChild(dt);
    const dd = document.createElement('dd');
    dd.textContent = selectedObject[field];
    dl.appendChild(dd);
  }
  
  elem.appendChild(dl);
};

async function initForModelKey(outEl, modelKey) {
  document.querySelector('#model-button').disabled = 'disabled';
  document.querySelector('#model-button').innerHTML = 'Loading...';
  const {model, maxPredictions} = await loadModel(modelKey);
  document.querySelector('#model-button').innerHTML = 'Loaded.';
  init(outEl, model, maxPredictions);
}




// search stuff
function readDomainFromEnv() {
  return 'https://services-edu.herokuapp.com';
}

function fetchJson(query, apiKey) {
    const domain = readDomainFromEnv();
    const headers = {'X-Services-Edu-Api-Key': apiKey};
    const url = `${domain}/images/search?q=${encodeURIComponent(query)}`;
    return fetch(url, {headers})
      .then(response => response.json());
}

function renderResults(targetEl, json) {
  targetEl.innerHTML = '';
  
  (json.items || []).forEach(item => {
    const el = document.createElement('div');

    const img = document.createElement('img');
    img.classList.add('ImageSearch-image');
    img.src = item.image.thumbnailLink;
    img.alt = item.title;
    img.width = item.image.thumbnailWidth;
    img.height = item.image.thumbnailHeight;
    el.appendChild(img);

    const source = document.createElement('div');
    source.classList.add('ImageSearch-image-source');
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.href = item.image.contextLink;
    source.text = item.displayLink;
    el.appendChild(source);
    
    targetEl.appendChild(el);
  });
}



// augmentation
function augmented(items) {
  return items;
  
//   var augs = [];
//   items.forEach(item => {
//     augs.push({
//       item,
//       augmented: false
//     });
//     augs.push({
//       ...item,
//       augmented: true,
//       uri: augmentedUri(item.uri)
//     });
//   });
//   return augs;
}



function augmentedUri(uri) {
  // todo(kr)
}

// util bits
function download(uri, filename) {
  var a = document.createElement("a");
  a.href = uri;
  a.setAttribute("download", filename);
  a.click();
  return false;
}

function hash64(str) {
  return window.CryptoJS.MD5(str).toString(window.CryptoJS.enc.Base64);
}

async function readInputFilesAsDataURL(files) {
  return await Promise.all([].map.call(files, file => {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        resolve({uri: e.target.result, filename: file.name});
      };
      reader.readAsDataURL(file);
    });
  }));
}

async function readInputFilesAsText(files) {
  return await Promise.all([].map.call(files, file => {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        resolve(e.target.result);
      };
      reader.readAsText(file);
    });
  }));
}


main();
