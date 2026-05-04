import './style.css';

const projectLinks = [
  { name: 'Project 1',     url: '/proj1/index.html'     }, 
  { name: 'Project 2',     url: '/proj2/index.html'     },
  { name: 'Project 3',     url: '/proj3/index.html'     },
  { name: 'Project 4',     url: '/proj4/index.html'     },
  { name: 'Project 5',     url: '/proj5/index.html'     },
  { name: 'Final Project', url: '/projFinal/index.html' },
];

function createProjectContainers(links) {
  const main = document.getElementById('page-content');
  links.forEach(({ name, url }) => {
    const containerDiv = document.createElement('div');
    const projTitle = document.createElement('div');
    const projImageLink = document.createElement('a');
    const projImageDiv = document.createElement('div');

    containerDiv.className = 'content project-card';
    projTitle.textContent = name;
    projImageLink.href = url;
    projImageDiv.className = 'project-card-thumbnail';

    containerDiv.appendChild(projTitle);
    containerDiv.appendChild(projImageLink);
    projImageLink.appendChild(projImageDiv);
    main.appendChild(containerDiv);
  });
}

createProjectContainers(projectLinks);
