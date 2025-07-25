let currentPage = 1;
let teamsPerPage = 5;
let totalPages = 1;
let currentSearchQuery = "";

document.addEventListener('DOMContentLoaded', function () {
  const colors = ['#E08963', '#5E96AE', '#f15f0e', '#A2C139']; // Màu luân phiên

    document.getElementById('reg-modal').addEventListener('shown.bs.modal', function () {
        document.getElementById('sample1').innerHTML = '';
        window.sample1 = new EmailsInput(document.getElementById('sample1'), {});
    });

    

   // Kiểm tra trạng thái đăng nhập bằng localStorage
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  // Hiển thị tên user
  document.getElementById('user_name').textContent = user.name || user.user_name || user.email;
  
  function renderTeams(teams, isSearch = false) {
      const teamList = document.getElementById('teamList');
      teamList.innerHTML = '';

      if (teams && teams.length > 0) {
          teams.forEach((team, index) => {
              const li = document.createElement('li');
              li.style.setProperty('--cardColor', colors[index % colors.length]);

              li.innerHTML = `
                  <a href="team-project.html?teamId=${team.team_id}" class="content">
                      <div class="icon">😁</div>
                      <div class="team-des">
                          <div class="title">${team.name}</div>
                      </div>
                  </a>
                  <div class="action container border-0 d-flex justify-content-end align-items-center">
                      <div class="row gap-4">
                          <div class="col fs-5 action-edit" data-team-id="${team.team_id}" data-team-name="${team.name}">
                              <i class="fa-solid fa-pen-to-square text-primary"></i>
                          </div>
                          <div class="col fs-5 action-delete" data-team-id="${team.team_id}">
                              <i class="fa-solid fa-trash-can text-primary"></i>
                          </div>
                      </div>
                  </div>
              `;
              teamList.appendChild(li);
          });

          document.querySelectorAll('.action-edit').forEach(button => {
              button.addEventListener('click', (event) => {
                  const teamId = event.currentTarget.getAttribute('data-team-id');
                  const teamName = event.currentTarget.getAttribute('data-team-name');
                  openUpdateModal(teamId, teamName);
              });
          });

          document.querySelectorAll('.action-delete').forEach(button => {
              button.addEventListener('click', async (event) => {
                  const teamId = event.currentTarget.getAttribute('data-team-id');
                  if (confirm("Are you sure you want to delete this team?")) {
                      await deleteTeam(teamId);
                  }
              });
          });
      } else {
          teamList.innerHTML = isSearch
              ? '<span>No teams match your search</span>'
              : '<span>No teams available</span>';
      }
  }

  // Fetch all team
//   async function fetchAllTeams() {
//       const teamList = document.getElementById('teamList');
//       teamList.innerHTML = '<span>Loading...</span>';
//       try {
//           const response = await fetch(`http://localhost:3000/api/team?created_by=${user.user_id}`);
//           if (!response.ok) throw new Error('Network response was not ok');
//           const data = await response.json();
//           renderTeams(data.teams, false);
//       } catch (error) {
//           console.error('Error fetching all teams:', error);
//           teamList.innerHTML = `
//           <div class="error-loading d-flex justify-content-center align-items-center flex-column">
//               <img src="../public/img/main-img/error-loading.png" alt="error" class="img-status">
//               <span class="text-status">Error loading</span>
//           </div>
//           `;
//       }
//   }
    async function fetchTeams(page = 1) {
        let url = `http://localhost:3000/api/team?created_by=${user.user_id}&page=${page}&limit=${teamsPerPage}`;
        if (currentSearchQuery) {
            url += `&search=${encodeURIComponent(currentSearchQuery)}`;
        }
        const response = await fetch(url);
        const data = await response.json();
        totalPages = data.totalPages;
        currentPage = page;
        renderTeams(data.teams, !!currentSearchQuery);
        renderPagination();
    }

  function renderPagination() {
    const containerId = 'pagination';
    let paginationDiv = document.getElementById(containerId);
    if (!paginationDiv) {
        paginationDiv = document.createElement('div');
        paginationDiv.id = containerId;
        paginationDiv.className = "team-pagination d-flex justify-content-center gap-2 my-3";
        // Đặt pagination phía dưới teamList, nhưng vẫn trong div#team
        document.getElementById('team').appendChild(paginationDiv);
    }
    paginationDiv.innerHTML = "";
    console.log('Total pages:', totalPages, 'Current page:', currentPage); // Debug log

    if (totalPages <= 1) {
        paginationDiv.style.display = "none";
        return;
    }
    paginationDiv.style.display = "flex";

    function pageBtn(page, text, disabled = false, active = false) {
        const btn = document.createElement('button');
        btn.textContent = text || page;
        btn.className = `btn btn-sm ${active ? 'btn-primary' : 'btn-outline-primary'}`;
        btn.disabled = disabled;
        btn.onclick = () => fetchTeams(page);
        return btn;
    }

    paginationDiv.appendChild(pageBtn(1, '« First', currentPage === 1));
    paginationDiv.appendChild(pageBtn(currentPage - 1, '‹ Prev', currentPage === 1));
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
        paginationDiv.appendChild(pageBtn(i, i, false, i === currentPage));
    }
    paginationDiv.appendChild(pageBtn(currentPage + 1, 'Next ›', currentPage === totalPages));
    paginationDiv.appendChild(pageBtn(totalPages, 'Last »', currentPage === totalPages));
    const info = document.createElement('span');
    info.className = "ms-3 fw-semibold text-primary";
    info.textContent = `${currentPage} / ${totalPages}`;
    paginationDiv.appendChild(info);
}

  // Delete team
  async function deleteTeam(teamId) {
      try {
          const response = await fetch(`http://localhost:3000/api/team/${teamId}`, {
              method: 'DELETE'
          });
          const result = await response.json();
          if (response.ok) {
              alert(result.message);
              fetchTeams(currentPage); // Làm mới danh sách team sau khi xóa
          } else {
              alert(result.message || "Failed to delete team.");
          }
      } catch (error) {
          console.error('Error deleting team:', error);
          alert("An error occurred while deleting the team.");
      }
  }

  // Update team
  function openUpdateModal(teamId, teamName) {
      document.getElementById('update-team-id').value = teamId;
      document.getElementById('update-team-name').value = teamName;

      const modal = new bootstrap.Modal(document.getElementById('update-modal'));
      modal.show();
  }

  async function updateTeam(event) {
      event.preventDefault();

      const teamId = document.getElementById('update-team-id').value;
      const teamName = document.getElementById('update-team-name').value.trim();

      if (!teamId || !teamName) {
          alert('Team ID or name is missing!');
          return;
      }

      try {
          const response = await fetch(`http://localhost:3000/api/team/${teamId}`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ teamName })
          });

          const result = await response.json();

          if (response.ok) {
              alert(result.message);
              fetchTeams(currentPage); // Refresh team list after update
              const modal = bootstrap.Modal.getInstance(document.getElementById('update-modal'));
              modal.hide();
          } else {
              alert(result.message || 'Failed to update team.');
          }
      } catch (error) {
          console.error('Error updating team:', error);
          alert('An error occurred while updating the team.');
      }
  }

  document.getElementById('updateTeamForm').addEventListener('submit', updateTeam);

  // Search teams based on query
  async function searchTeams(searchQuery) {
      const teamList = document.getElementById('teamList');
      teamList.innerHTML = '<span>Searching...</span>';
      try {
          const url = `http://localhost:3000/api/team?search=${encodeURIComponent(searchQuery.trim())}&created_by=${user.user_id}`;
          const response = await fetch(url);
          if (!response.ok) throw new Error('Network response was not ok');
          const data = await response.json();
          renderTeams(data.teams, true); // Pass isSearch=true for search-specific messaging
      } catch (error) {
          console.error('Error searching teams:', error);
          teamList.innerHTML = '<span>Error searching teams</span>';
      }
  }

  // Debounce helper to limit API calls
  function debounce(func, delay) {
      let timeout;
      return (...args) => {
          clearTimeout(timeout);
          timeout = setTimeout(() => func(...args), delay);
      };
  }

  // Setup search functionality
  const searchInput = document.getElementById('searchTeam');
  if (searchInput) {
      const debouncedSearch = debounce(query => {
          const trimmedQuery = query.trim();
          if (trimmedQuery) {
              searchTeams(trimmedQuery); // Search when there's a query
          } else {
              fetchAllTeams(); // Fetch all teams only when search is cleared
          }
      }, 300);

      searchInput.addEventListener('input', () => {
          debouncedSearch(searchInput.value);
      });

      searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
              e.preventDefault();
              const query = searchInput.value.trim();
              if (query) {
                  searchTeams(query); // Immediate search on Enter
              } else {
                  fetchAllTeams(); // Immediate fetch all on Enter when empty
              }
          }
      });
  }

  const createTeamForm = document.getElementById('createTeamForm');
  if (createTeamForm) {
      createTeamForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const teamName = document.getElementById('modal-team-name').value.trim();
          const emails = window.sample1 && typeof window.sample1.getValue === 'function'
            ? window.sample1.getValue()
            : [];
          console.log('Emails:', emails); // Debug log
          if (!teamName) {
              alert('Team name is required.');
              return;
          }
          try {
            //   const response = await fetch('http://localhost:3000/api/team', {
            //       method: 'POST',
            //       headers: { 'Content-Type': 'application/json' },
            //       body: JSON.stringify({ teamName })
            //   });
            console.log('Creating team with:', { teamName, created_by: user.user_id, emails, host: user.email });
            const response = await fetch('http://localhost:3000/api/team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamName, created_by: user.user_id, emails, host: user.email }) // gửi kèm created_by
            });
              const result = await response.json();
              if (response.ok) {
                  alert(result.message);
                  const currentQuery = searchInput.value.trim();
                  if (currentQuery) {
                      searchTeams(currentQuery); // Refresh with current search query
                  } else {
                      fetchTeams(1); // Refresh full list if no search active
                  }
                  bootstrap.Modal.getInstance(document.getElementById('reg-modal')).hide();
                  if (window.sample1 && typeof window.sample1.clear === 'function') {
                    window.sample1.clear();
                  }
                  createTeamForm.reset();
              } else {
                  alert(result.message || 'Failed to create team.');
              }
          } catch (error) {
              console.error('Error creating team:', error);
              alert('An error occurred while creating the team.');
          }
      });
  }

    // Khi search
    searchInput.addEventListener('input', () => {
        currentSearchQuery = searchInput.value.trim();
        console.log('Current search query:', currentSearchQuery); // Debug log
        currentPage = 1;
        fetchTeams(1);
    });

    fetchTeams(1); // Fetch all teams on initial load

//   fetchAllTeams();
});