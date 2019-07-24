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
  document.querySelector('#search').addEventListener('click', async function(e) {
    const query = prompt('Search for:');
    if (!query) return;
    
    const json = await fetchJson(query, 'abc');
    const uris = (json.items || []).map(item => item.image.thumbnailLink);
    // const uris = (json.items || []).map(item => item.link);
    console.log(' search results:', uris.length);

    // predict
    for (var i = 0; i < uris.length; i++) {
      const {prediction} = await predictForUri(model, maxPredictions, uris[i]);
      items.push({prediction, uri: uris[i], query});
    }

    // render
    renderItems(outEl, maxPredictions, augmented(items));
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



// facets
async function facets(targetEl, items) {
  // flatten data, round numbers for UX
  const facetsData = items.map(function(item, i) {
    return {
      i,
      hashedURI: hash64(item.uri),
      fromSource: (item.filename ? 'file' : item.query ? 'search' : 'unknown'),
      filename: item.filename || 'none',
      filenameLabel: item.filenameLabel || 'none',
      searchQuery: item.query || 'none',
      [item.prediction[0].className]: parseFloat(item.prediction[0].probability.toFixed(4)),
      [item.prediction[1].className]: parseFloat(item.prediction[1].probability.toFixed(4))
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
    facetsDiveEl.colorBy = classNames[0];
    facetsDiveEl.verticalFacet = classNames[0];
    facetsDiveEl.verticalBuckets = 4;
    facetsDiveEl.horizontalFacet = 'searchQuery';
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
