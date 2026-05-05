# GitHub Loader Perchance Plugin - https://perchance.org/load-from-github

- Create a perchance plugin that allows you to use files from https://raw.githubusercontent.com/ in your HTML code, you can follow the steps below.

- This plugin will enable you to load JavaScript, CSS, HTML, Markdown, JSON, and other file types directly from GitHub.

1. Create a new JavaScript file for your plugin, for example, `load-from-github.js`.

2. Add the following code to your `load-from-github.js` file:

```javascript
(function () {
  // Function to load a file from GitHub
  function loadFromGitHub(url, type) {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.text();
      })
      .then((data) => {
        if (type === "js") {
          const script = document.createElement("script");
          script.textContent = data;
          document.head.appendChild(script);
        } else if (type === "css") {
          const style = document.createElement("style");
          style.textContent = data;
          document.head.appendChild(style);
        } else if (type === "html") {
          const div = document.createElement("div");
          div.innerHTML = data;
          document.body.appendChild(div);
        } else if (type === "md") {
          const markdownContainer = document.createElement("div");
          markdownContainer.innerHTML = marked(data); // Assuming you have a Markdown parser like marked.js
          document.body.appendChild(markdownContainer);
        } else if (type === "json") {
          const jsonData = JSON.parse(data);
          console.log(jsonData); // You can handle JSON data as needed
        }
      })
      .catch((error) => {
        console.error("Error loading file from GitHub:", error);
      });
  }

  // Expose the function to the global scope
  window.loadFromGitHub = loadFromGitHub;
})();
```

3. Include the plugin in your HTML file:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GitHub Loader Example</title>
    <script src="load-from-github.js"></script>
  </head>
  <body>
    <script>
      // Example usage of the plugin to load different types of files from GitHub
      loadFromGitHub(
        "https://raw.githubusercontent.com/Mosberg/Ant/refs/heads/main/index.html",
        "html"
      );
      loadFromGitHub(
        "https://raw.githubusercontent.com/Mosberg/Ant/refs/heads/main/styles.css",
        "css"
      );
      loadFromGitHub("https://raw.githubusercontent.com/Mosberg/Ant/refs/heads/main/main.js", "js");
    </script>
  </body>
</html>
```

3,1. You can also include the plugin in your Perchance.org list of plugins if you want to use it within the Perchance environment.

```perchance
loadFromGitHub = {import:load-from-github}
```

4. Make sure to replace the URLs in the `loadFromGitHub` function calls with the actual URLs of the files you want to load from GitHub.

5. If you want to load Markdown files, ensure you have a Markdown parser like `marked.js` included in your project to convert Markdown to HTML.

6. Save your HTML file and open it in a browser to see the loaded content from GitHub.

This plugin allows you to easily load various types of files from GitHub into your HTML code, making it a versatile tool for web development.
