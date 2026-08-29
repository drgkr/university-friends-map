const state = { friends: [], filtered: [], map: null, mapLoaded: false, homeBounds: null };

const elements = {
  search: document.querySelector('#search'), specialty: document.querySelector('#specialty-filter'),
  country: document.querySelector('#country-filter'), clear: document.querySelector('#clear-filters'),
  emptyClear: document.querySelector('#empty-clear'), list: document.querySelector('#friend-list'),
  empty: document.querySelector('#empty-state'), results: document.querySelector('#result-count'),
  error: document.querySelector('#error-message'), fitMap: document.querySelector('#fit-map'),
  resetMap: document.querySelector('#reset-map')
};

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const initials = name => name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
const avatar = friend => friend.photo
  ? `<span class="avatar"><img src="${escapeHtml(friend.photo)}" alt="" loading="lazy" onerror="this.parentElement.textContent='${initials(friend.name)}'"></span>`
  : `<span class="avatar" aria-hidden="true">${initials(friend.name)}</span>`;

function specialtyTone(specialty) {
  if (/surgery|orthopaedics|gynaecology|ent/i.test(specialty)) return 'surgery';
  if (/general practice|hospital medicine/i.test(specialty)) return 'primary';
  return 'medicine';
}

function popup(friend) {
  return `<article class="popup"><div class="popup-top">${avatar(friend)}<div><h3>${escapeHtml(friend.name)}</h3><p class="friend-role">${escapeHtml(friend.specialty)}</p></div></div><p>⌖ ${escapeHtml(friend.city)}, ${escapeHtml(friend.country)}</p>${friend.note ? `<p>${escapeHtml(friend.note)}</p>` : ''}</article>`;
}

function friendCard(friend) {
  return `<button class="friend-card" type="button" data-id="${escapeHtml(friend.id)}" aria-label="Show ${escapeHtml(friend.name)} on map">${avatar(friend)}<span class="friend-info"><h3>${escapeHtml(friend.name)}</h3><p class="friend-role">${escapeHtml(friend.specialty)}</p><p class="friend-place">⌖ ${escapeHtml(friend.city)}, ${escapeHtml(friend.country)}</p></span><span class="card-arrow" aria-hidden="true">›</span></button>`;
}

function offsetLocations(friends) {
  const groups = new Map();
  friends.forEach(friend => {
    const key = `${friend.latitude}|${friend.longitude}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(friend);
  });
  const positions = new Map();
  groups.forEach(group => group.forEach((friend, index) => {
    if (group.length === 1) return positions.set(friend.id, [friend.longitude, friend.latitude]);
    const angle = (Math.PI * 2 * index / group.length) - Math.PI / 2;
    const radius = 0.025 + Math.min(group.length, 10) * 0.002;
    positions.set(friend.id, [friend.longitude + Math.cos(angle) * radius, friend.latitude + Math.sin(angle) * radius]);
  }));
  return positions;
}

function toGeoJSON(friends) {
  const positions = offsetLocations(friends);
  return {
    type: 'FeatureCollection',
    features: friends.map(friend => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: positions.get(friend.id) },
      properties: { id: friend.id, name: friend.name, initials: initials(friend.name), specialty: friend.specialty, tone: specialtyTone(friend.specialty) }
    }))
  };
}

function addFriendLayers() {
  if (state.map.getSource('friends')) return;
  state.map.addSource('friends', { type: 'geojson', data: toGeoJSON(state.filtered), cluster: true, clusterMaxZoom: 10, clusterRadius: 48 });
  state.map.addLayer({
    id: 'clusters', type: 'circle', source: 'friends', filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#277866', 8, '#176b58', 20, '#10483d'],
      'circle-radius': ['step', ['get', 'point_count'], 21, 8, 25, 20, 30],
      'circle-stroke-width': 4, 'circle-stroke-color': 'rgba(255,255,255,.9)', 'circle-opacity': 0.96
    }
  });
  state.map.addLayer({
    id: 'cluster-count', type: 'symbol', source: 'friends', filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-font': ['Noto Sans Bold'] },
    paint: { 'text-color': '#ffffff' }
  });
  state.map.addLayer({
    id: 'friend-points', type: 'circle', source: 'friends', filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 7, 8, 11, 12, 14],
      'circle-color': ['match', ['get', 'tone'], 'surgery', '#c26146', 'primary', '#6b5ca5', '#277866'],
      'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.98, 'circle-stroke-opacity': 0.95
    }
  });
  state.map.addLayer({
    id: 'friend-initials', type: 'symbol', source: 'friends', filter: ['!', ['has', 'point_count']], minzoom: 7,
    layout: { 'text-field': ['get', 'initials'], 'text-size': 9, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true },
    paint: { 'text-color': '#ffffff' }
  });

  state.map.on('click', 'clusters', async event => {
    const feature = event.features[0];
    const zoom = await state.map.getSource('friends').getClusterExpansionZoom(feature.properties.cluster_id);
    state.map.easeTo({ center: feature.geometry.coordinates, zoom: Math.min(zoom, 12), duration: 650 });
  });
  state.map.on('click', 'friend-points', event => {
    const friend = state.friends.find(item => item.id === event.features[0].properties.id);
    if (friend) openPopup(friend, event.features[0].geometry.coordinates);
  });
  ['clusters', 'friend-points'].forEach(layer => {
    state.map.on('mouseenter', layer, () => { state.map.getCanvas().style.cursor = 'pointer'; });
    state.map.on('mouseleave', layer, () => { state.map.getCanvas().style.cursor = ''; });
  });
}

function initialiseMap() {
  state.map = new maplibregl.Map({
    container: 'map', style: 'https://tiles.openfreemap.org/styles/liberty', center: [20, 22], zoom: 1.4,
    minZoom: 1.2, maxZoom: 16, attributionControl: false, cooperativeGestures: true
  });
  state.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  state.map.addControl(new maplibregl.FullscreenControl(), 'bottom-right');
  state.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
  state.map.on('load', () => {
    state.mapLoaded = true;
    addFriendLayers();
    updateMapData();
    state.homeBounds = boundsFor(state.friends);
    resetMap(false);
  });
  state.map.on('error', event => {
    if (event.error) console.warn('Map resource error:', event.error.message);
  });
}

function boundsFor(friends) {
  if (!friends.length) return null;
  const bounds = new maplibregl.LngLatBounds();
  friends.forEach(friend => bounds.extend([friend.longitude, friend.latitude]));
  return bounds;
}

function updateMapData() {
  if (!state.mapLoaded || !state.map.getSource('friends')) return;
  state.map.getSource('friends').setData(toGeoJSON(state.filtered));
}

function fitVisible() {
  const bounds = boundsFor(state.filtered);
  if (bounds) state.map.fitBounds(bounds, { padding: 55, maxZoom: 8, duration: 700 });
}

function resetMap(animated = true) {
  if (state.homeBounds) state.map.fitBounds(state.homeBounds, { padding: 50, maxZoom: 4, duration: animated ? 700 : 0 });
}

function openPopup(friend, coordinates) {
  new maplibregl.Popup({ offset: 18, closeButton: true, maxWidth: '300px' })
    .setLngLat(coordinates).setHTML(popup(friend)).addTo(state.map);
}

function fillSelect(select, values) {
  [...new Set(values)].sort((a,b) => a.localeCompare(b)).forEach(value => {
    const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option);
  });
}

function matches(friend) {
  const query = elements.search.value.trim().toLowerCase();
  const haystack = [friend.name, friend.specialty, friend.city, friend.country].join(' ').toLowerCase();
  return (!query || haystack.includes(query)) && (!elements.specialty.value || friend.specialty === elements.specialty.value) && (!elements.country.value || friend.country === elements.country.value);
}

function render() {
  state.filtered = state.friends.filter(matches);
  elements.list.innerHTML = state.filtered.map(friendCard).join('');
  elements.results.textContent = `${state.filtered.length} ${state.filtered.length === 1 ? 'person' : 'people'}`;
  elements.empty.hidden = state.filtered.length !== 0;
  elements.list.hidden = state.filtered.length === 0;
  elements.clear.hidden = !elements.search.value && !elements.specialty.value && !elements.country.value;
  updateMapData();
  if (state.filtered.length && state.filtered.length !== state.friends.length) fitVisible();
}

function showFriend(id) {
  const friend = state.friends.find(item => item.id === id);
  if (!friend || !state.mapLoaded) return;
  if (window.innerWidth < 901) document.querySelector('.map-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  const position = offsetLocations(state.friends).get(friend.id);
  state.map.flyTo({ center: position, zoom: 10, duration: 900, essential: true });
  state.map.once('moveend', () => openPopup(friend, position));
}

function clearFilters() { elements.search.value = ''; elements.specialty.value = ''; elements.country.value = ''; render(); resetMap(); elements.search.focus(); }

async function start() {
  try {
    const response = await fetch('data/friends.json?v=2'); if (!response.ok) throw new Error();
    state.friends = await response.json(); state.filtered = state.friends;
    fillSelect(elements.specialty, state.friends.map(friend => friend.specialty));
    fillSelect(elements.country, state.friends.map(friend => friend.country));
    document.querySelector('#friend-count').textContent = state.friends.length;
    document.querySelector('#city-count').textContent = new Set(state.friends.map(friend => `${friend.city}|${friend.country}`)).size;
    document.querySelector('#country-count').textContent = new Set(state.friends.map(friend => friend.country)).size;
    render(); initialiseMap();
  } catch {
    elements.error.hidden = false;
    elements.error.textContent = 'The friends directory could not be loaded. Please refresh the page and try again.';
  }
}

elements.search.addEventListener('input', render);
elements.specialty.addEventListener('change', render);
elements.country.addEventListener('change', render);
elements.clear.addEventListener('click', clearFilters);
elements.emptyClear.addEventListener('click', clearFilters);
elements.list.addEventListener('click', event => { const card = event.target.closest('[data-id]'); if (card) showFriend(card.dataset.id); });
elements.fitMap.addEventListener('click', fitVisible);
elements.resetMap.addEventListener('click', () => resetMap());
window.addEventListener('DOMContentLoaded', start);
