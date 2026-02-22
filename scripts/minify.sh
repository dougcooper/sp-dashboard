#!/bin/bash

PROJECT="$1"
html-minifier-terser \
    --collapse-whitespace \
    --remove-comments \
    --remove-optional-tags \
    --minify-css true \
    --minify-js true \
    -o build/$PROJECT/index.html $PROJECT/index.html