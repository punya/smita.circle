"use strict";

function getOrAddChild(node, child) {
    var len = node.children.length;
    for (var i = 0; i < len; ++i) {
        if (node.children[i].name === child) {
            return node.children[i];
        }
    }
    var newNode = {"name": child, "children": []};
    node.children.push(newNode);
    return newNode;
}

function getOrAddPath(node, path) {
    var pieces = path.split(", ");
    var len = pieces.length;
    for (var i = 0; i < len; ++i) {
        node = getOrAddChild(node, pieces[i]);
    }
    return node;
}

var w = 1200, h = 800;
var r0 = h/2 * 0.08;
var color = d3.scale.category20c();
var linkColor = d3.scale.category10();
var radScale = d3.scale.linear()
    .range([0.1 * h, 0.21 * h]);

var svg = d3.select("#chart")
    .append("svg:svg")
        .attr("width", w)
        .attr("height", h)
        .attr("transform", "scale(0.5, 0.5)");

function subplot(i, j) {
    return svg.append("svg:g")
        .attr("transform", "translate(" + i * w / 6 + ", " + j * h / 4 + ")");
}

function value(node) {
    if (isNaN(node.value)) {
        node.value = 0;
        var len = node.children.length;
        for (var i = 0; i < len; ++i) {
            node.value += value(node.children[i]);
        }
        node.value = Math.max(node.value, node.name.length);
    }
    return node.value;
}

var partition = d3.layout.partition()
    .sort(function(a, b) { return d3.ascending(a.name, b.name); })
    .size([2 * Math.PI, 1])
    .children(function(d) { return d.children.length === 0 ? null : d.children; })
    .value(function(d) { return 1; }); 

var arc = d3.svg.arc()
    .startAngle(function(d) { return d.x; })
    .endAngle(function(d) { return d.x + d.dx; })
    .innerRadius(function(d) { return radScale(d.y); })
    .outerRadius(function(d) { return radScale(d.y + d.dy); });

var line = d3.svg.line.radial()
    .interpolate("bundle")
    .tension(.85)
    .radius(function(d) { return radScale(d.y); })
    .angle(function(d) { return d.x + d.dx / 2; });

var bundle = d3.layout.bundle();

d3.csv('./diff.csv', function(rows) {
    var root = {"name": "root", "children": []};
    var len = rows.length;
    var links = {"++": [], "+-": [], "-+": [], "--": [], "?+": [], "?-": []};
    for (var i = 0; i < len; ++i) {
        var row = rows[i];
        var cors = row.uninfected + row.infected;
        if (links[cors] === undefined) {
            continue;
        }
        links[cors].push({
            "source": getOrAddPath(root, unescape(row.source)),
            "target": getOrAddPath(root, unescape(row.target))
        });
    }

    function half(s, ary, cls) {
        var g = s.selectAll("path.node")
            .data(partition.nodes(root))
            .enter().append("svg:g")
            .attr("display", function(d) { return d.depth === 0 ? "none" : null; });
    
        g.append("svg:path")
            .attr("class", "arc")
            .attr("d", arc)
            .style("fill", function(d) { return d.name === "Serum" ? color("CD11b") : color(d.name); })
            .style("stroke-width", 1);
    
        g.append("svg:text")
            .attr("transform", function(d) {
                var rot = (d.x + d.dx / 2 - Math.PI / 2) / Math.PI * 180;
                return "rotate(" + rot + ")";
            })
            .attr("x", function(d) { return radScale(d.y); })
            .attr("dx", ".15em")
            .attr("dy", ".35em")
            .attr("class", "arclabel")
            .text(function(d) { return d.name; });
    
    
        function filt2(d) {
            return d.name === 'Gr1' && d.parent.name === 'Spleen';
        }
        function filt(d) {
            return filt2(d[0]) || filt2(d[d.length - 1]);
        }
        for (var i = 0; i < ary.length; ++i) {
            s.selectAll("path.link" + i)
                .data(bundle(links[ary[i]]))
                .enter().append("svg:path")
                    .attr("d", line)
                    .attr("class", function(d) { return cls + (filt(d) ? " hi" : ""); }) 
                    .style("stroke", function(d) { return filt(d) ? "black" : linkColor(ary[i]); });
        }
    }

    half(subplot(1, 1), ["++"], "edge blue");
    half(subplot(1, 3), ["+-"], "edge");
    half(subplot(3, 1), ["-+"], "edge green");
    half(subplot(3, 3), ["--"], "edge");
    half(subplot(5, 1), ["?+"], "edge purple");
    half(subplot(5, 3), ["?-"], "edge");

    svg.selectAll("g.legend")
        .data(["++", "+-", "-+", "--", "?+", "?-"])
        .enter().append("svg:text")
        .attr("x", function(d, i) { return w / 2 + (i - 2) * 50; })
        .attr("y", h / 2 + 5)
        .attr("class", "legendtext")
        .style("fill", linkColor)
        .text(function(d) { return d[0] + "\u2192" + d[1]; });
});

