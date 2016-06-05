import {EthereumNetwork} from './EthereumNetwork.js';
import { Tracker } from 'meteor/tracker'

class NetworkGraph {
  /*
  selection: html element in which to inset the graph
  data: JSON object of the graph data
  updateDOM: function that will triger updates to the containing DOM
  */
  constructor (selection, data, updateDOM) {
    this._updateDOM = updateDOM;
    this.width = 660;
    this.height = 500;
    this.curLinksData = new Set();
    this.curNodesData = new Set();
    ///this.nodeColors = d3.scale.category20();
    this._selectedNode = null;
    this.graphData = this._setupData(data);
    let vis = d3.select(selection)
    .append('svg').attr('width', this.width)
    .attr('height', this.height);
    this.linksG = vis.append('g').attr('id', 'links');
    this.nodesG = vis.append('g').attr('id', 'nodes');
    this.force = d3.layout.force()
    .size([this.width, this.height])
    .charge(-500)
    .linkDistance(200)
    .on('tick', this._forceTick.bind(this));
    this._update();
  }
  _setupData (data) {
    data.nodes.forEach((n) => {
      n.x = Math.floor(Math.random() * this.width);
      n.y = Math.floor(Math.random() * this.height);
      //TODO: scale radious based on number of peers
      n.r = 5;
    });
    data.nodes = new Set(data.nodes);
    data.links.forEach((l) => {
      //order statically to prevent duplicates
      var source = l.source.localeCompare(l.target) ? l.source : l.target;
      var target = l.source.localeCompare(l.target) ? l.target : l.source;
      l.source = EthereumNetwork.getNodeByID(source);
      l.target = EthereumNetwork.getNodeByID(target);
    });
    data.links = new Set(data.links);
    return data;
  }
  _forceTick (e) {
    let node = this.nodesG.selectAll('circle.node').data(this.curNodesData, function (d) {
      return d.nodeID;
    });

    node
    .attr('cx', (d) => { return d.x; })
    .attr('cy', (d) => { return d.y; });

    let link = this.linksG.selectAll('line.link').data(this.curLinksData, function (d) {
      return d.source.nodeID + '_' + d.target.nodeID;
    });

    link
    .attr('x1', (d) => { return d.source.x; })
    .attr('y1', (d) => { return d.source.y; })
    .attr('x2', (d) => { return d.target.x; })
    .attr('y2', (d) => { return d.target.y; });
  }
  /*_strokeFor (d) {
  return d3.rgb(this.nodeColors(d.artist)).darker().toString();
  }*/
  _updateNodes () {
    let node = this.nodesG.selectAll('circle.node')
    .data(this.curNodesData, function (d) {
      return d.nodeID;
    });

    this.nodesG.selectAll('circle.node')
    .data(this.curNodesData, function (d) {
      return d.nodeID;
    })
    .enter()
    .call((d) => {
      Tracker.autorun(() => {
        if(d[0].length > 0) {
          d3.selectAll(d[0]).data().forEach( (ethereumNode) => {
            ethereumNode.LogData.find({}).observeChanges({
              added: function (id, data) {
                console.log(id, data);
              },
            });
          });
        }
      });
    });

    let networkGraph = this;
    node.enter()
    .append('circle')
    .attr('class', 'node')
    .attr('cx', (d) => { return d.x; })
    .attr('cy', (d) => { return d.y; })
    .attr('r', (d) => { return d.r; })
    //.style('fill', (d) => { return this.nodeColors(d.artist); })
    //.style('stroke', (d) => { return this._strokeFor(d); })
    .style('stroke-width', 1.0)
    .on('click', function () {
      networkGraph.nodesG.selectAll('circle.node').attr('fill', '#000');
      networkGraph._selectedNode = d3.select(this);
      networkGraph._selectedNode.attr('fill', '#f00');
      networkGraph._updateDOM();
    });
    //this.node.on('mouseover', showDetails).on('mouseout', hideDetails);
    node.exit().remove();
  }
  _updateLinks () {
    let link = this.linksG.selectAll('line.link').data(this.curLinksData, function (d) {
      return d.source.nodeID + '_' + d.target.nodeID;
    });
    link
    .enter().append('line')
    .attr('class', 'link')
    .attr('stroke', '#ddd')
    .attr('x1', (d) => { return d.source.x; })
    .attr('y1', (d) => { return d.source.y; })
    .attr('x2', (d) => { return d.target.x; })
    .attr('y2', (d) => { return d.target.y; });
    link.exit().remove();
  }
  _update () {
    this.curNodesData = [...this.graphData.nodes];
    this.curLinksData = [...this.graphData.links];

    this.force.nodes(this.curNodesData);
    this._updateNodes();
    this.force.links(this.curLinksData);
    this._updateLinks();
    this.force.start();
  }
  updateGraphData (newData) {
    this.graphData = this._setupData(newData);
    this._update();
  }
  addGraphData (newData) {
    var graphData = this._setupData(newData);
    graphData.nodes.forEach((node) => {
      this.graphData.nodes.add(node);
    });
    graphData.links.forEach((link) => {
      this.graphData.links.add(link);
    });
    this._update();
  }
  getSelectedNode () {
    if(!this._selectedNode) {
      return null;
    }
    return this._selectedNode.data()[0];
  }
}

export {NetworkGraph};