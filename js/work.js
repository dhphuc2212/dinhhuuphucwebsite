window.GaoOngDuData = [
  { name: 'GẠO ST25 "HỮU CƠ" 1KG', weight: "1", price: "72,000" },
  { name: 'GẠO ST25 "HỮU CƠ" 5KG', weight: "5", price: "360,000" },
  { name: 'GẠO ST25 "TD XANH" 1KG', weight: "1", price: "52,000" },
  { name: 'GẠO ST25 "TD XANH" 5KG', weight: "5", price: "260,000" },
  { name: 'GẠO TẤM ST25 "HỮU CƠ" 2KG', weight: "2", price: "82,000" },
  { name: "GẠO LÀI THƠM 1KG", weight: "1", price: "35,500" },
  { name: "GẠO LÀI THƠM 5KG", weight: "5", price: "177,500" },
  { name: "GẠO LỨT DÂU TÂY ĐỎ 1KG", weight: "1", price: "112,000" },
  { name: "GẠO LỨT DÂU TÂY TÍM 1KG", weight: "1", price: "112,000" },
  { name: "GẠO NẾP SẾU ĐẦU ĐỎ 1KG", weight: "1", price: "112,000" },
  { name: "GẠO NẾP CHIM SÂM CẦM 1KG", weight: "1", price: "112,000" },
  { name: "GẠO SUMO", weight: "1", price: "112,000" }
];

window.initWorkSection = function () {
  const tbody = document.getElementById("pricingTableBody");
  const searchInput = document.getElementById("productSearchInput");
  if (!tbody) return;

  function renderRows(keyword = "") {
    const q = keyword.trim().toLowerCase();
    const filtered = window.GaoOngDuData.filter((item) =>
      item.name.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">Không tìm thấy sản phẩm phù hợp.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map(
        (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${item.name}</strong></td>
          <td class="text-center">${item.weight}</td>
          <td class="text-right"><span class="price-badge">${item.price}</span></td>
          <td class="text-right">
            <a href="https://zalo.me/0983533945" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm hover-arrow">
              <span>Đặt qua Zalo</span>
              <span class="arrow">→</span>
            </a>
          </td>
        </tr>
      `
      )
      .join("");
  }

  renderRows();

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderRows(e.target.value);
    });
  }
};
