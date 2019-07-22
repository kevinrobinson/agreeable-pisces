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

    const outEl = document.createElement('pre');
    document.body.appendChild(outEl);
  
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
  
  document.querySelector('#file-selector').addEventListener('change', function(event) {
    readFiles(event, function(uris) {
      outEl.innerHTML = outEl.innerHTML + '\n' + JSON.stringify(uris);
    });
  });
                                                            
//          var fr = new FileReader();
//         fr.onload = function () {
//             document.getElementById(outImage).src = fr.result;
//         }
//         fr.readAsDataURL(files[0]);
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
    var selectedFile = event.target.files[0];
    var reader = new FileReader();
    reader.onload = function(event) {
      console.log('onLoad', event);
      uris.push(event.target.result);
      if (uris.length >= event.target.files) {
        console.log('next', uris);
        next(uri);
      }
    };
    console.log('selectedFile', selectedFile);
    reader.readAsDataURL(selectedFile);
  });
}
  
init();
  
  