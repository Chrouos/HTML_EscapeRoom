const express = require('express');

const { content } = require('../game/content/contentSchema');
const { endings } = require('../game/content/endings');
const { buildTechnicalStoryGraph } = require('../game/authoring/storyGraph');
const { buildStoryMapModel } = require('../game/authoring/storyGraphPresentation');
const { storyGraphMetadata } = require('../game/authoring/storyGraphMetadata');
const { diagnoseStoryGraph } = require('../game/authoring/storyGraphDiagnostics');

function defaultBuildModel() {
  const technicalGraph = buildTechnicalStoryGraph({
    contentBundle: content,
    endingCatalog: endings
  });
  const storyMap = buildStoryMapModel(technicalGraph, storyGraphMetadata);
  const diagnostics = diagnoseStoryGraph({
    contentBundle: content,
    endingCatalog: endings,
    technicalGraph,
    storyMap
  });

  return {
    ...storyMap,
    diagnostics
  };
}

function partialModel(error) {
  return {
    nodes: [],
    edges: [],
    stages: [],
    lanes: [],
    stats: {
      nodes: 0,
      edges: 0,
      partial: true
    },
    diagnostics: [{
      code: 'GRAPH_BUILD_ERROR',
      severity: 'error',
      nodeId: null,
      title: '部分故事資料無法解析',
      message: error instanceof Error ? error.message : String(error),
      relatedNodeIds: []
    }]
  };
}

function createAuthorRoutes(options = {}) {
  const router = express.Router();
  const buildModel = options.buildModel || defaultBuildModel;

  router.use((request, response, next) => {
    if (request.app.get('env') === 'production') return next('router');
    return next();
  });

  router.get('/reveal-graph', (request, response) => {
    response.render('author/revealGraph');
  });

  router.get('/api/reveal-graph', (request, response) => {
    try {
      response.json(buildModel());
    } catch (error) {
      response.json(partialModel(error));
    }
  });

  return router;
}

module.exports = {
  createAuthorRoutes,
  defaultBuildModel,
  partialModel
};
