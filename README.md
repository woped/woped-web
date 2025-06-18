# WoPeD Webclient

This repository contains the WoPeD Webclient. <br>
The application has been built based on [angular-starter](https://github.com/wlucha/angular-starter)

Navigate to <https://woped.github.io/woped-frontend/home> to use the WoPeD Webclient.

## Development

After cloning this repository, it's essential to [set up git hooks](https://github.com/woped/woped-git-hooks/blob/main/README.md#activating-git-hooks-after-cloning-a-repository) to ensure project standards.

## Docker Deployment

```bash
# Build Docker image
$ docker build . -t p2t-woped-webservice-frontend

# Run Docker Container
$ docker run -p 3000:80 p2t-woped-webservice-frontend
```
