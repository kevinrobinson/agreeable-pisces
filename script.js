let model;
let webcamEl;


async function init(modelKey) {
  // the json file (model topology) has a reference to the bin file (model weights)
  const checkpointURL = `https://storage.googleapis.com/tm-mobilenet/${modelKey}/model.json`;
  // the metatadata json file contains the text labels of your model and additional information
  const metadataURL = `https://storage.googleapis.com/tm-mobilenet/${modelKey}/metadata.json`;

  // load the model and metadata
  model = await tmImage.mobilenet.load(checkpointURL, metadataURL);
  const maxPredictions = model.getTotalClasses();

  const outEl = document.querySelector('.TileTwo');
    
  document.querySelector('#load-dump-json').addEventListener('change', async function(event) {
    const files = await readInputFilesAsText(event.target.files);
    window.files = files;
    const items = JSON.parse(files[0]);
    renderItems(outEl, maxPredictions, items);
  });
  
  document.querySelector('#dump').disabled = 'disabled';
  document.querySelector('#file-selector').addEventListener('change', function(event) {
    readFiles(event, async function(uris) {
      // predict
      var items = [];
      for (var i = 0; i < uris.length; i++) {
        const {prediction} = await predictForUri(maxPredictions, uris[i]);
        items.push({prediction, uri: uris[i]});
      }
      
      // render
      renderItems(outEl, maxPredictions, items);
    
    
      // allow dump
      document.querySelector('#dump').disabled = false;
      document.querySelector('#dump').addEventListener('click', function(e) {
        alert(JSON.stringify(items));
        console.log(JSON.stringify(items));
        const pre = document.createElement('pre');
        pre.innerText = JSON.stringify(items, null, 2);
        outEl.appendChild(pre);
      })
    });
  });
}

const renderBar = _.template(`<div>
  <div class="Tile-class"><%- className %></div>
  <div class="Tile-number"><%- Math.round(probability*100) %></div>
  <div class="Tile-bar">
    <div class="Tile-bar-element" style="background: green; width: <%- Math.round(probability*100) %>%;"></div>
    <div class="Tile-bar-element"style="background: #ccc; width: <%- 100 - Math.round(probability *100) %>%;"></div>
  </div>
</div>`);

async function predictForUri(maxPredictions, uri) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = async function() {
      const prediction = await model.predict(img, false, maxPredictions);
      resolve({prediction, uri});
    };
    img.src = uri;
  });
}


// items [{prediction, uri}]
function renderItems(targetEl, maxPredictions, items) {
  const itemsEl = targetEl.querySelector('.Items');
  itemsEl.innerHTML = '';
  items.forEach(item => {
    const {uri, prediction} = item;
    const el = document.createElement('div');
    el.classList.add('Tile');

    var img = document.createElement('img');
    img.src = uri;
    el.appendChild(img);
    
    const info = document.createElement('div');
    info.classList.add('Tile-info');
    const consistentPrediction = _.sortBy(prediction, 'className');
    const html = `<div>
      ${consistentPrediction.map(renderBar).join('')}
    </div>`;
    info.innerHTML = html;
    el.appendChild(info);
      
    itemsEl.appendChild(el);
  });
  
  const facetsEl = targetEl.querySelector('.Facets');
  facetsEl.innerHTML = '';
  facets(facetsEl, items);
}


async function predictLoop(outEl, maxPredictions) {

  // predict can take in an image, video or canvas html element
  // we set flip to true since the webcam was only flipped in CSS
  const flip = true;
  const prediction = await model.predict(webcamEl, flip, maxPredictions);
  outEl.innerHTML = outEl.innerHTML + '\n' + JSON.stringify(prediction);
  predictLoop(outEl, maxPredictions);
}


function readFiles(event, next) {
  console.log('event.target.files', event.target.files);
  var uris = [];
  
  [].forEach.call(event.target.files, selectedFile => {
    var reader = new FileReader();
    reader.onload = function(e) {
      uris.push(e.target.result);
      if (uris.length >= event.target.files.length) {
        console.log('next', uris);
        next(uris);
      }
    };
    console.log('selectedFile', selectedFile);
    reader.readAsDataURL(selectedFile);
  });
}
  

// generic
async function readInputFilesAsDataURL(files, options = {}) {
  return await Promise.all([].map.call(files, file => {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        resolve(e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }));
}

// generic
async function readInputFilesAsText(files, options = {}) {
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

async function facets(targetEl, items) {  
  const el = document.createElement('div');
  el.innerHTML = '<facets-dive width="800" height="600" />';
  targetEl.appendChild(el);

  // flatten
  var facetsData = items.map(function(item, i) {
    return {
      // uri: item.uri,
      i,
      [item.prediction[0].className]: item.prediction[0].probability,
      [item.prediction[1].className]: item.prediction[1].probability
    };
  });
  console.log('facetsData', facetsData);

  // config
  var facetsDiveEl = targetEl.querySelector('facets-dive');
  console.log('facetsDiveEl', facetsDiveEl);
  
  // the order of these calls matters
  const classNames = _.uniq(_.flatMap(items, item => item.prediction.map(p => p.className)));
  console.log('classNames', classNames);
  facetsDiveEl.data = facetsData;
  // facetsDiveEl.hideInfoCard = true;
  facetsDiveEl.colorBy = classNames[0];
  facetsDiveEl.verticalFacet = classNames[0];
  facetsDiveEl.horizontalFacet = classNames[1];
  
  // sprite sheet
  // see https://github.com/PAIR-code/facets/tree/master/facets_dive#providing-sprites-for-dive-to-render
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
      img.src = item.uri;
    });
  }));
  
  const uri = canvas.toDataURL();
  return {canvas, uri};
}

document.querySelector('#model-key').change(e => {
  init(e.target.value);
});
