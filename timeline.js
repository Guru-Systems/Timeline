/*
Timeline

Javascript library for visualising event data.
See demo.html for how to use and timeline.md for detailed API.

Copyright Guru Systems Ltd 2014.
Tom Young <tom.young@gurusystems.com>
*/

function Timeline(domID, data, conf)
{
	if (conf.sortLines)
		sortLines(data, conf);
	var d = makeFlotData(data, conf);
	var flotConfig = makeFlotConfig(conf);
	var flotObject = $.plot(domID, d.flotData, flotConfig);
	
	// Pull the Y axis up to the top so that if the tick labels are links
	// we can click on them
	//$('.flot-y-axis').css('zIndex',2);

	// If someone selects a portion, zoom in
	$(domID).bind("plotselected", function (event, ranges) {
		flotObject.clearSelection();
		flotObject.getOptions().xaxes[0].min = ranges.xaxis.from
		flotObject.getOptions().xaxes[0].max = ranges.xaxis.to
		flotObject.setupGrid();
		flotObject.draw();
	});

	// If someone double clicks the plot, reset to default view
	function reset() {
		flotObject.getOptions().xaxes[0].min = null
		flotObject.getOptions().xaxes[0].max = null
		flotObject.setupGrid();
		flotObject.draw();
	}
	$(domID).dblclick(reset);
	
	// If someone hovers over a point, display some info
   	var previousPoint = null;
    $(domID).bind("plothover", function (event, pos, item) {
		if (item) {
			if (previousPoint != item.dataIndex) {
				previousPoint = item.dataIndex;
				$("#timelineTooltip").remove();
				var tooltipHtml = d.tooltips[item.seriesIndex][item.dataIndex];
				if(tooltipHtml)
					showTooltip(item.pageX, item.pageY, tooltipHtml);
			}
		}
		else {
			$("#timelineTooltip").fadeOut(400, function () {this.remove(); });;
			previousPoint = null;            
		}
	});
	
	return flotObject;
}

function sortLines(data, conf)
/*
There are currently two types of sorting supported:
	- specify conf.sortLines.categories = ["one", "two"] to sort lines
		by the number of events of category "one" and then by the number of
		of category "two" (etc).
	- if you set conf.sortLines but don't set conf.sortLines.categories then
		we will sort by the total number of events on each line
Specify conf.sortLines.direction = "ascending" or "descending" (default descending)
*/
{
	// Score each line based on a weighted count of events in the categories
	// specified in conf.sortLines.categories, then modify the conf.lines
	// array to have the new order.
	
	// Before we modify conf.lines, make a deep copy in case it has been
	// shallow-copied from a client's data.
	if (conf.lines === undefined)
		conf.lines = [];
	else
		conf.lines = conf.lines.slice(0);
	
	var scores = [];
	for (i=0; i<conf.lines.length; ++i)
		scores[i] = 0;
	
	for (i=0; i<data.length; ++i)
	{
		// Check that the lines array contains the line from this event
		if (conf.lines.indexOf(data[i].line) < 0)
		{
			conf.lines.push(data[i].line);
			scores.push(0);
		}
		
		if (conf.sortLines.categories)
		{
			// If the event is in one of the specified sort categories,
			// increase the score, weighting categories earlier in the 
			// list more highly (by a ratio of data.length for each place).
			s = conf.sortLines.categories.indexOf(data[i].category);
			if (s >= 0)
			{
				lineIndex = conf.lines.indexOf(data[i].line);
				scores[lineIndex] += Math.pow(data.length, (conf.sortLines.categories.length - s - 1));
			}
		}
		else
		// Sort by total number of events on line
		{
			lineIndex = conf.lines.indexOf(data[i].line);
			scores[lineIndex]++;
		}
	}	
	
	// work out the new indices
	var order = [];
	for (i=0; i<scores.length; ++i)
		order[i] = i;
	if (conf.sortLines.direction == "ascending")
		order.sort(function (a, b) { return scores[b] - scores[a]; });
	else
		order.sort(function (a, b) { return scores[a] - scores[b]; });
	
	// Sort the lines
	var oldLines = conf.lines.slice(0);
	for (i=0; i<conf.lines.length; ++i)
		conf.lines[i] = oldLines[order[i]];

	// Sort the line labels
	if (conf.lineLabels)
	{
		var oldLineLabels = conf.lineLabels.slice(0);
		for (i=0; i<conf.lineLabels.length; ++i)
			conf.lineLabels[i] = oldLineLabels[order[i]];
	}
}

function makeFlotData(data, conf)
{
	var categories = [];
	if (conf.lines === undefined)
		conf.lines = [];
	var flotData = []; // one object per category
	var tooltips = [];
	
	function getCategoryIndex(category)
	{
		var y = categories.indexOf(category);
		if (y >= 0)
			return y;
		else
		{
			jQuery.extend(conf.categories[category], {'data': []});
			flotData.push(conf.categories[category]);
			tooltips.push([]);
			return categories.push(category) - 1;
		}
	}	
	
	function getLineIndex(line)
	{
		var y = conf.lines.indexOf(line);
		if (y >= 0)
			return y;
		else
			return conf.lines.push(line) - 1;
	}	
	
	for (i=0; i<data.length; ++i)
	{
		var iCategory = getCategoryIndex(data[i].category);
		var iLine = getLineIndex(data[i].line);
		flotData[iCategory].data.push([data[i].time, iLine]);
		if (data[i].endTime !== undefined)
		{
			tooltips[iCategory].push(data[i].label + " started");
			flotData[iCategory].data.push([data[i].endTime, iLine]);
			tooltips[iCategory].push(data[i].label + " ended");
		}
		else
			tooltips[iCategory].push(data[i].label);
		flotData[iCategory].data.push(null);
		tooltips[iCategory].push(null);
	}
	return {"flotData": flotData, "tooltips": tooltips};
}

function makeFlotConfig(conf)
{
	var tz = 'browser';
	if (conf.timezone !== undefined)
		tz = conf.timezone;

	var d = {
		xaxis: {
			mode: "time",
			timezone: tz,
			tickLength: 5,
			position: "top",
		},
		yaxis: { max: conf.lines.length },
		selection: {mode: "x", color: "green" },
		lines: { show: true , lineWidth: 3},
		points: { show: true, fillColor: false},
		shadowSize: 0,
		grid: {
			borderWidth: {top:1, bottom:0, left:0, right:0}, 
			labelMargin: 10,
			hoverable: true,
			clickable: true
		},
	}
	
	if (conf.lineLabels)
	{
		d.yaxis.ticks = [];
		for (iLine=0; iLine<conf.lines.length; iLine++)
			if (iLine < conf.lineLabels.length && conf.lineLabels[iLine] !== undefined)
				d.yaxis.ticks.push([iLine, conf.lineLabels[iLine]]);
			else
				// Run out of labels, try using the line index itself (as a string)
				d.yaxis.ticks.push([iLine, "" + conf.lines[iLine]]);
	}	
	else
	{
		// disable labeling
		d.yaxis.tickSize = 1;
		d.yaxis.tickFormatter = function(val, axis) { return ''; };
	}

	return d;
};

function showTooltip(x, y, contents) {
	$('<div id="timelineTooltip">' + contents + '</div>').css( {
		position: 'absolute',
		display: 'none',
		top: y + 5,
		left: x + 5,
		border: "1px solid #ddf",
		padding: "10px",
		"background-color": "#efd",
		margin: 0,
	    "font-size": "smaller",
	}).appendTo("body").fadeIn(200);
}