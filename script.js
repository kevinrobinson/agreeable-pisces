/* If you're feeling fancy you can add interactivity 
    to your site with Javascript */

// the json file (model topology) has a reference to the bin file (model weights)
const checkpointURL = 'https://storage.googleapis.com/tm-mobilenet/2019072224505fifaexperiment/model.json';
// the metatadata json file contains the text labels of your model and additional information
const metadataURL = 'https://storage.googleapis.com/tm-mobilenet/2019072224505fifaexperiment/metadata.json';

let model;
let webcamEl;

async function init() {
    // load the model and metadata
    model = await tmImage.mobilenet.load(checkpointURL, metadataURL);
    const maxPredictions = model.getTotalClasses();

    const outEl = document.querySelector('.TileTwo');
  
    // optional function for creating a webcam
    // webcam has a square ratio and is flipped by default to match training
//     const webcamFlipped = true;
//     webcamEl = await tmImage.getWebcam(200, 200, 'front', webcamFlipped);
//     webcamEl.play();
//     document.body.appendChild(webcamEl);

//     // live from camera
//     predictLoop(outEl);

  
    // use tmImage.mobilenet.loadFromFiles() function to support files from a file picker or files from your local hard drive
    // you need to create File objects, like with file input elements (<input type="file" ...>)
    // const uploadJSONInput = document.getElementById('upload-json');
    // const uploadWeightsInput = document.getElementById('upload-weights');
    // model = await tmImage.mobilenet.loadFromFiles(uploadJSONInput.files[0], uploadWeightsInput.files[0])
  
  document.querySelector('#load-dump-json').addEventListener('change', async function(event) {
    const files = await readInputFilesAsText(event.target.files);
    window.files = files;
    console.log('files[0]', files[0]);
    const items = JSON.parse(files[0]);
    console.log('items', items);
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
  targetEl.innerHTML = '';
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
      
    targetEl.appendChild(el);
  });
  
  facets(targetEl, items);
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
  
init();
  
  

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

function facets(targetEl, items) {
  const el = document.createElement('div');
  el.innerHTML = '<facets-dive width="800" height="600" color-by="feeling" />';
  targetEl.appendChild(el);

  // flatten
  var facetsData = items.map(function(item) {
    return {
      uri: item.uri,
      [item.prediction[0].className]: item.prediction[0].probability,
      [item.prediction[1].className]: item.prediction[1].probability
    };
  });

  // config
  var facetsDiveEl = options.containerEl.querySelector('facets-dive');

  // the order of these calls matters
  facetsDiveEl.data = facetsData;
  facetsDiveEl.hideInfoCard = true;
  facetsDiveEl.colorBy = 'feeling';
  facetsDiveEl.verticalFacet = 'shape';
  facetsDiveEl.horizontalFacet = 'color';
}