# Makefile for generating minified files

.PHONY: all

all: jquery.flot.min.js jquery.flot.selection.min.js timeline.min.js

%.min.js: %.js
	yui-compressor $< -o $@
