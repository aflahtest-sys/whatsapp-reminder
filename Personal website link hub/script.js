const search = document.getElementById("search");
const cards = Array.from(document.querySelectorAll(".card"));
const emptyState = document.getElementById("empty-state");

function filterSites() {
  const query = search.value.trim().toLowerCase();
  let visible = 0;

  cards.forEach((card) => {
    const name = card.dataset.name.toLowerCase();
    const description = card.dataset.description.toLowerCase();
    const matches = !query || name.includes(query) || description.includes(query);

    card.classList.toggle("hidden", !matches);
    if (matches) visible += 1;
  });

  emptyState.classList.toggle("hidden", visible > 0);
}

search.addEventListener("input", filterSites);
