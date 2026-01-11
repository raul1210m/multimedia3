let albums = [];
let filtered = [];

const albumsRow = document.getElementById("albumsRow");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const playSpotifyBtn = document.getElementById("playSpotifyBtn");

function parseLengthToSeconds(len) {
  const [m, s] = (len || "0:00").split(":").map(Number);
  return (m * 60) + (s || 0);
}

function secondsToMMSS(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function computeStats(tracks) {
  const n = tracks.length;
  const secs = tracks.map(t => parseLengthToSeconds(t.length));
  const total = secs.reduce((a, b) => a + b, 0);
  const avg = n ? Math.round(total / n) : 0;

  let longestIdx = 0;
  let shortestIdx = 0;
  secs.forEach((v, i) => {
    if (v > secs[longestIdx]) longestIdx = i;
    if (v < secs[shortestIdx]) shortestIdx = i;
  });

  return {
    n,
    total,
    avg,
    longest: tracks[longestIdx],
    shortest: tracks[shortestIdx],
  };
}

function sortAlbums(list, mode) {
  const copy = [...list];
  switch (mode) {
    case "artist-az":
      copy.sort((a, b) => a.artist.localeCompare(b.artist));
      break;
    case "album-az":
      copy.sort((a, b) => a.album.localeCompare(b.album));
      break;
    case "tracks-asc":
      copy.sort((a, b) => a.tracks.length - b.tracks.length);
      break;
    case "tracks-desc":
      copy.sort((a, b) => b.tracks.length - a.tracks.length);
      break;
  }
  return copy;
}

function renderAlbums(list) {
  albumsRow.innerHTML = "";

  list.forEach((a, idx) => {
    const col = document.createElement("div");
    col.className = "col-xl-2 col-md-3 col-sm-6 col-12";

    col.innerHTML = `
      <div class="card h-100 d-flex flex-column album-card">
        <img src="assets/img/${a.thumbnail}" class="card-img-top album-img" alt="${a.artist} - ${a.album}">
        <div class="card-body">
          <h5 class="card-title">${a.artist}</h5>
          <p class="card-text">${a.album}</p>
        </div>
        <div class="card-footer mt-auto bg-transparent border-0">
          <button
            class="btn btn-primary w-100 view-tracklist-btn"
            data-index="${idx}"
            data-bs-toggle="modal"
            data-bs-target="#tracklistModal"
          >
            View Tracklist
          </button>
        </div>
      </div>
    `;

    albumsRow.appendChild(col);
  });
}

// Event delegation (un singur listener)
albumsRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".view-tracklist-btn");
  if (!btn) return;

  const idx = Number(btn.dataset.index);
  const album = filtered[idx];

  modalTitle.textContent = `${album.artist} - ${album.album}`;

  const stats = computeStats(album.tracks);
  const statsHtml = `
    <div class="mb-3 p-3 bg-light rounded">
      <div class="row g-2">
        <div class="col-6 col-md-3"><strong>Tracks:</strong> ${stats.n}</div>
        <div class="col-6 col-md-3"><strong>Total:</strong> ${secondsToMMSS(stats.total)}</div>
        <div class="col-6 col-md-3"><strong>Average:</strong> ${secondsToMMSS(stats.avg)}</div>
        <div class="col-12 col-md-6"><strong>Longest:</strong> ${stats.longest.title} (${stats.longest.length})</div>
        <div class="col-12 col-md-6"><strong>Shortest:</strong> ${stats.shortest.title} (${stats.shortest.length})</div>
      </div>
    </div>
  `;

  const rows = album.tracks.map((t, i) => `
    <tr>
      <td class="text-muted">${i + 1}</td>
      <td>
        <a class="link-primary link-underline-opacity-0 link-underline-opacity-75-hover"
           href="${t.url}" target="_blank" rel="noopener">
          ${t.title}
        </a>
      </td>
      <td class="text-end">${t.length}</td>
    </tr>
  `).join("");

  modalBody.innerHTML = `
    ${statsHtml}
    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th style="width: 60px;">#</th>
            <th>Title</th>
            <th class="text-end" style="width: 90px;">Length</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  const first = album.tracks[0];
  if (first?.url) {
    playSpotifyBtn.href = first.url;
    playSpotifyBtn.classList.remove("d-none");
  } else {
    playSpotifyBtn.classList.add("d-none");
  }
});

function applyFilterAndSort() {
  const q = (searchInput.value || "").trim().toLowerCase();
  const mode = sortSelect.value;

  const base = albums.filter(a =>
    a.artist.toLowerCase().includes(q) || a.album.toLowerCase().includes(q)
  );

  filtered = sortAlbums(base, mode);
  renderAlbums(filtered);
}

searchInput.addEventListener("input", applyFilterAndSort);
sortSelect.addEventListener("change", applyFilterAndSort);

// Back to top
const backToTop = document.getElementById("backToTop");
window.addEventListener("scroll", () => {
  backToTop.classList.toggle("d-none", window.scrollY < 400);
});
backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

async function init() {
  try {
    const res = await fetch("library.json");
    if (!res.ok) throw new Error("Could not load library.json");
    albums = await res.json();

    filtered = sortAlbums(albums, sortSelect.value);
    renderAlbums(filtered);
  } catch (err) {
    albumsRow.innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">Error: ${err.message}</div>
      </div>
    `;
  }
}
init();
