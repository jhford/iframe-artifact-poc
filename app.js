const express = require('express');
const gzip = require('zlib');

// Let's create the App we'll use
const app = express();

// Some simple CSS to make this not totally the ugliest thing ever.  I am no
// CSS expert though
const css = `
html, body {
  height: 95%;
  width: 95%;
  margin: 0;
  padding: 0;
}

iframe {
  width: 95%;
  height: 95%;
  margin: 0;
  padding: 0;
  border: 5px solid red;
}

input#urlbox {
  width: 300px;
}
`;

// A function which renders the HTML page that we're going to send to the user
// if they're needing the viewer element instead of being a programatic script
// that can handle the artifact directly
//
// NOTE: We're using the 'sandbox' attribute to try to make this as safe as possible
function renderBrowserPage(url, title) {
  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    `<style type="text/css"> ${css} </style>`,
    `<title>Artifact: ${title}</title>`,
    `<script>
      window.onload = function() {
          document.querySelector('#urlbox').value = window.location;
          document.querySelector('#copyurl').addEventListener("click", function() {
            document.querySelector('#urlbox').value = window.location;
            document.querySelector("#urlbox").select();
            document.execCommand("copy");
          });
      }
    </script>`,
    "<body><h1>Artifact</h1>",
    "<input id='urlbox' type='text' />",
    "<button id='copyurl'>Copy</button>",
    `<iframe referrerpolicy="origin" sandbox src="${url}" />`,
    "</body>",
    "</html>",    
  ].join('\n');
}


// Let's store a map of object names to some various contents.  These are
// picked to highlight the various cases we're interested in like HTML, JSON,
// text, gzip (content, but not content-encoding) and a binary file
const objects = new Map();

objects.set('json', {
  contentType: 'application/json',
  value:  JSON.stringify({
    Value1: "John",
    Value2: 123,
    Value3: {a: 1, b:2},
  }, null, 2),
});

objects.set('text', {
  contentType: 'text/plain',
  value: 'Hello, artifact viewer!',
});

objects.set('gzip', {
  contentType: 'application/gzip',
  value: Buffer.from('H4sIAPoy51oAA/PKz8jjAgAPZUvqBQAAAA==', 'base64'),
});

// NOTE: the final example from:
// https://www.muppetlabs.com/~breadbox/software/tiny/teensy.html
// DON'T RUN THIS!
objects.set('exe', {
  contentType: 'application/octet-stream',
  value: Buffer.from('f0VMRgEAAAAAAAAAAAABAAIAAwAgAAEAIAABAAQAAACzKjHAQM2AADQAIAAB', 'base64'),
});

objects.set('html', {
  contentType: 'text/html; charset=utf-8',
  value: `
    <html>
    <head><title>Hello, HTML!</title></head>
    <body>
      <button onClick="alert(window.location)">Show Location</button>
    </body>
    </html>
  `,
});


// Pretend this method is the Queue's getArtifact method
app.get('/queue/artifacts/:name', (req, res) => {

  const ua = req.headers['user-agent'].trim();

  const isBrowser = /^Mozilla/.test(ua);
  const hasReferrer = !!req.headers['referrer'];

  if (isBrowser && !hasReferrer) {
    res.send(renderBrowserPage(`/object-service/objects/${req.params.name}`, req.path));
  } else {
    res.redirect('/object-service/objects/' + req.params.name);
  }

});

// Pretend this is the endpoint of the Object service which will be used to
// retreive the actual object
app.get('/object-service/objects/:name', (req, res) => {
  if (objects.has(req.params.name)) {
    let {contentType, value} = objects.get(req.params.name);
    res.set('Content-Type', contentType);
    res.send(value);
  } else {
    res.status(404).send('Artifact not found');
  } 
});

const port = process.env.PORT || 8080
app.listen(port, () => console.log('Listening on :' + port));
