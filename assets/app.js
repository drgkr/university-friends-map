const state = { friends: [], markers: new Map(), map: null, cluster: null, homeBounds: null };

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

function initialiseMap() {
  state.map = L.map('map', { scrollWheelZoom: false, zoomControl: false, worldCopyJump: true, minZoom: 2 });
  const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(state.map);
  const humanitarian = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors · Tiles by HOT'
  });
  L.control.zoom({ position: 'bottomright' }).addTo(state.map);
  L.control.layers({ 'Classic streets': streets, 'Clear contrast': humanitarian }, null, { position: 'topright' }).addTo(state.map);
  state.cluster = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 50, spiderfyOnMaxZoom: true,
    spiderfyDistanceMultiplier: 1.7, animateAddingMarkers: true,
    iconCreateFunction: cluster => L.divIcon({
      html: `<span>${cluster.getChildCount()}</span>`, className: 'friend-cluster', iconSize: [46, 46]
    })
  });
  state.map.addLayer(state.cluster);
}

function specialtyTone(specialty) {
  if (/surgery|orthopaedics|gynaecology|ent/i.test(specialty)) return 'surgery';
  if (/general practice|hospital medicine/i.test(specialty)) return 'primary';
  return 'medicine';
}

function markerIcon(friend) {
  return L.divIcon({ className: `custom-marker ${specialtyTone(friend.specialty)}`, html: `<span>${initials(friend.name)}</span>`, iconSize: [38, 44], iconAnchor: [19, 40], popupAnchor: [0, -38] });
}

function popup(friend) {
  return `<article class="popup"><div class="popup-top">${avatar(friend)}<div><h3>${escapeHtml(friend.name)}</h3><p class="friend-role">${escapeHtml(friend.specialty)}</p></div></div>${friend.jobTitle ? `<p><strong>${escapeHtml(friend.jobTitle)}</strong></p>` : ''}${friend.organisation ? `<p>${escapeHtml(friend.organisation)}</p>` : ''}<p>⌖ ${escapeHtml(friend.city)}, ${escapeHtml(friend.country)}</p>${friend.note ? `<p>${escapeHtml(friend.note)}</p>` : ''}</article>`;
}

function makeMarkers() {
  state.friends.forEach(friend => {
    const marker = L.marker([friend.latitude, friend.longitude], { icon: markerIcon(friend), title: friend.name });
    marker.bindPopup(popup(friend));
    state.markers.set(friend.id, marker);
  });
}

function fillSelect(select, values) {
  [...new Set(values)].sort((a,b) => a.localeCompare(b)).forEach(value => {
    const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option);
  });
}

function matches(friend) {
  const query = elements.search.value.trim().toLowerCase();
  const haystack = [friend.name, friend.specialty, friend.jobTitle, friend.organisation, friend.city, friend.country].join(' ').toLowerCase();
  return (!query || haystack.includes(query)) && (!elements.specialty.value || friend.specialty === elements.specialty.value) && (!elements.country.value || friend.country === elements.country.value);
}

function friendCard(friend) {
  return `<button class="friend-card" type="button" data-id="${escapeHtml(friend.id)}" aria-label="Show ${escapeHtml(friend.name)} on map">${avatar(friend)}<span class="friend-info"><h3>${escapeHtml(friend.name)}</h3><p class="friend-role">${escapeHtml(friend.specialty)}</p><p class="friend-place">⌖ ${escapeHtml(friend.city)}, ${escapeHtml(friend.country)}</p></span><span class="card-arrow" aria-hidden="true">›</span></button>`;
}

function render() {
  const filtered = state.friends.filter(matches);
  elements.list.innerHTML = filtered.map(friendCard).join('');
  elements.results.textContent = `${filtered.length} ${filtered.length === 1 ? 'person' : 'people'}`;
  elements.empty.hidden = filtered.length !== 0;
  elements.list.hidden = filtered.length === 0;
  elements.clear.hidden = !elements.search.value && !elements.specialty.value && !elements.country.value;
  state.cluster.clearLayers();
  filtered.forEach(friend => state.cluster.addLayer(state.markers.get(friend.id)));
  if (filtered.length && filtered.length !== state.friends.length) fitVisible();
}

function fitVisible() {
  if (!state.cluster || !state.cluster.getLayers().length) return;
  state.map.fitBounds(state.cluster.getBounds(), { padding: [46, 46], maxZoom: 8, animate: true });
}

function resetMap() {
  if (state.homeBounds) state.map.fitBounds(state.homeBounds, { padding: [42, 42], maxZoom: 4, animate: true });
}

function showFriend(id) {
  const friend = state.friends.find(item => item.id === id); const marker = state.markers.get(id);
  if (!friend || !marker) return;
  if (window.innerWidth < 901) document.querySelector('.map-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  state.map.setView([friend.latitude, friend.longitude], 7, { animate: true });
  state.cluster.zoomToShowLayer(marker, () => marker.openPopup());
}

function clearFilters() { elements.search.value = ''; elements.specialty.value = ''; elements.country.value = ''; render(); elements.search.focus(); }

async function start() {
  try {
    const response = await fetch('data/friends.json?v=2'); if (!response.ok) throw new Error();
    state.friends = await response.json();
    initialiseMap(); makeMarkers();
    fillSelect(elements.specialty, state.friends.map(friend => friend.specialty));
    fillSelect(elements.country, state.friends.map(friend => friend.country));
    document.querySelector('#friend-count').textContent = state.friends.length;
    document.querySelector('#city-count').textContent = new Set(state.friends.map(friend => `${friend.city}|${friend.country}`)).size;
    document.querySelector('#country-count').textContent = new Set(state.friends.map(friend => friend.country)).size;
    render();
    state.homeBounds = state.cluster.getBounds();
    resetMap();
  } catch {
    elements.error.hidden = false;
    elements.error.textContent = 'The friends directory could not be loaded. If you opened the HTML file directly, run it through a local web server or GitHub Pages.';
  }
}

elements.search.addEventListener('input', render);
elements.specialty.addEventListener('change', render);
elements.country.addEventListener('change', render);
elements.clear.addEventListener('click', clearFilters);
elements.emptyClear.addEventListener('click', clearFilters);
elements.list.addEventListener('click', event => { const card = event.target.closest('[data-id]'); if (card) showFriend(card.dataset.id); });
elements.fitMap.addEventListener('click', fitVisible);
elements.resetMap.addEventListener('click', resetMap);
window.addEventListener('DOMContentLoaded', start);
