const dashboardUser = getUser();
const profileName = document.querySelector('[data-profile-name]');
const profileUsername = document.querySelector('[data-profile-username]');
const dashboardMessage = document.querySelector('[data-dashboard-message]');
const totalBalanceValue = document.querySelector('[data-total-balance]');
const youOweValue = document.querySelector('[data-you-owe]');
const youAreOwedValue = document.querySelector('[data-you-are-owed]');
const groupsList = document.querySelector('[data-groups-list]');
const personalList = document.querySelector('[data-personal-list]');
const notificationsList = document.querySelector('[data-notifications-list]');
const activityList = document.querySelector('[data-activity-list]');
const settlementList = document.querySelector('[data-settlement-list]');
const groupOwesList = document.querySelector('[data-group-owes-list]');
const createGroupForm = document.querySelector('[data-create-group-form]');
const addPersonalExpenseForm = document.querySelector('[data-add-personal-expense-form]');
const logoutButton = document.querySelector('[data-logout]');

const formatUserHandle = (user) => {
  const username = String(user?.username || '').trim().toLowerCase();
  if (username && username !== 'unknown_user') {
    return username;
  }

  const name = String(user?.name || '').trim().toLowerCase();
  if (name && name !== 'unknown user') {
    const normalizedName = name.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (normalizedName && normalizedName !== 'unknown_user') {
      return normalizedName;
    }
  }

  const fallbackId = String(user?._id || user?.id || '').trim();
  return fallbackId ? `member_${fallbackId.slice(-6).toLowerCase()}` : 'member';
};

const renderItems = (container, items, emptyLabel) => {
  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!items.length) {
    container.innerHTML = `<div class="list-item muted">${emptyLabel}</div>`;
    return;
  }

  container.innerHTML = items.map((item) => `<div class="list-item">${item}</div>`).join('');
};

const renderSettlementItems = (container, settlements) => {
  if (!container) {
    return;
  }

  if (!settlements.length) {
    container.innerHTML = '<div class="list-item muted">No settlements yet.</div>';
    return;
  }

  container.innerHTML = settlements
    .map((settlement) => {
      const statusLabel = settlement.status === 'completed' ? 'Completed' : 'Pending';
      const toUserId = String(settlement.toUser?._id || settlement.toUser?.id || '');
      const currentDashboardUserId = String(dashboardUser?.id || dashboardUser?._id || '');
      const actionButton = settlement.status === 'pending' && toUserId === currentDashboardUserId
        ? `<button class="button secondary" type="button" data-settlement-settle="${settlement._id}">Mark settled</button>`
        : '';
      const fromUser = formatUserHandle(settlement.fromUser);
      const toUser = formatUserHandle(settlement.toUser);

      return `
        <div class="list-item">
          <strong>@${fromUser} → @${toUser}</strong>
          <div class="muted">${Number(settlement.amount).toFixed(2)} · ${statusLabel}</div>
          ${settlement.groupId?.name ? `<div class="muted">Group: ${settlement.groupId.name}</div>` : ''}
          ${settlement.note ? `<div class="muted">${settlement.note}</div>` : ''}
          <div class="form-actions" style="margin-top: 12px;">${actionButton}</div>
        </div>
      `;
    })
    .join('');
};

const renderGroupOwesItems = (container, groupSummaries) => {
  if (!container) {
    return;
  }

  const seenRows = new Set();

  const summaryItems = groupSummaries.flatMap((groupSummary) => {
    if (!groupSummary.settlements.length) {
      return [];
    }

    return groupSummary.settlements.map((item) => {
      const fromUsername = formatUserHandle(item.fromUser);
      const toUsername = formatUserHandle(item.toUser);
      const normalizedAmount = Number(item.amount || 0).toFixed(2);
      const dedupeKey = `${groupSummary.groupId || groupSummary.groupName}|${fromUsername}|${toUsername}|${normalizedAmount}`;

      if (seenRows.has(dedupeKey)) {
        return '';
      }

      seenRows.add(dedupeKey);

      return `
        <div class="list-item">
          <strong>${groupSummary.groupName}</strong>
          <div class="muted">@${fromUsername} owes @${toUsername}</div>
          <div class="muted">Amount: ${normalizedAmount}</div>
        </div>
      `;
    });
  }).filter(Boolean);

  if (!summaryItems.length) {
    container.innerHTML = '<div class="list-item muted">No pending group debts right now.</div>';
    return;
  }

  container.innerHTML = summaryItems.join('');
};

const loadDashboard = async () => {
  if (!dashboardUser) {
    window.location.href = 'login.html';
    return;
  }

  if (profileName) {
    profileName.textContent = dashboardUser.name;
  }

  if (profileUsername) {
    profileUsername.textContent = dashboardUser.username || dashboardUser.name?.toLowerCase().replace(/\s+/g, '_') || 'member';
  }

  try {
    const [profile, groupsResponse, expensesResponse, notificationsResponse] = await Promise.all([
      apiRequest('/profile'),
      apiRequest('/groups'),
      apiRequest('/expenses/personal'),
      apiRequest('/notifications'),
    ]);

    const summaryResponse = await apiRequest('/profile/summary');
    const activityResponse = await apiRequest('/activity/logs');

    const groupSummaries = await Promise.all(
      groupsResponse.groups.map(async (group) => {
        try {
          const response = await apiRequest(`/group/${group._id}/summary`);
          return {
            groupId: group._id,
            groupName: group.name,
            settlements: response.settlements || [],
          };
        } catch (_error) {
          return {
            groupId: group._id,
            groupName: group.name,
            settlements: [],
          };
        }
      })
    );

    if (profileName) {
      profileName.textContent = profile.user.name;
    }

    if (profileUsername) {
      profileUsername.textContent = profile.user.username || profile.user.name?.toLowerCase().replace(/\s+/g, '_') || 'member';
    }

    if (totalBalanceValue) {
      totalBalanceValue.textContent = Number(summaryResponse.totalBalance || 0).toFixed(2);
    }

    if (youOweValue) {
      youOweValue.textContent = Number(summaryResponse.youOwe || 0).toFixed(2);
    }

    if (youAreOwedValue) {
      youAreOwedValue.textContent = Number(summaryResponse.youAreOwed || 0).toFixed(2);
    }

    renderItems(
      groupsList,
      groupsResponse.groups.map((group) => `<strong>${group.name}</strong><div class="muted">${group.members.length} member(s)</div><a class="button secondary" href="group.html?id=${group._id}">Open group</a>`),
      'No groups yet. Create one to begin.'
    );

    renderItems(
      personalList,
      expensesResponse.expenses.map((expense) => `<strong>${expense.title}</strong><div class="muted">${expense.amount.toFixed(2)} on ${new Date(expense.date).toLocaleDateString()}</div>`),
      'No personal expenses yet.'
    );

    renderItems(
      notificationsList,
      notificationsResponse.notifications.map((notification) => `<strong>${notification.message}</strong><div class="muted">${new Date(notification.date).toLocaleString()}</div>`),
      'No notifications yet.'
    );

    renderItems(
      activityList,
      activityResponse.activityLogs.map((activity) => `<strong>${activity.action.replaceAll('_', ' ')}</strong><div class="muted">${new Date(activity.createdAt).toLocaleString()}</div>`),
      'No activity yet.'
    );

    renderSettlementItems(settlementList, summaryResponse.recentSettlements);
    renderGroupOwesItems(groupOwesList, groupSummaries);

    if (dashboardMessage) {
      dashboardMessage.textContent = 'Connected to your account successfully.';
    }
  } catch (error) {
    if (dashboardMessage) {
      dashboardMessage.textContent = error.message;
      dashboardMessage.classList.add('danger');
    }
  }
};

if (settlementList) {
  settlementList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-settlement-settle]');
    if (!button) {
      return;
    }

    const settlementId = button.dataset.settlementSettle;

    try {
      button.disabled = true;
      await apiRequest(`/settlements/${settlementId}/mark-settled`, {
        method: 'PATCH',
      });
      await loadDashboard();
    } catch (error) {
      if (dashboardMessage) {
        dashboardMessage.textContent = error.message;
        dashboardMessage.classList.add('danger');
      }
    } finally {
      button.disabled = false;
    }
  });
}

if (createGroupForm) {
  createGroupForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const body = Object.fromEntries(new FormData(createGroupForm).entries());
      await apiRequest('/group/create', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      createGroupForm.reset();
      await loadDashboard();
    } catch (error) {
      if (dashboardMessage) {
        dashboardMessage.textContent = error.message;
        dashboardMessage.classList.add('danger');
      }
    }
  });
}

if (addPersonalExpenseForm) {
  addPersonalExpenseForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const body = Object.fromEntries(new FormData(addPersonalExpenseForm).entries());
      body.amount = Number(body.amount);
      body.groupId = null;
      body.splitType = 'equal';
      body.paidBy = dashboardUser?.id || dashboardUser?._id;

      await apiRequest('/expense/add', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      addPersonalExpenseForm.reset();
      await loadDashboard();
    } catch (error) {
      if (dashboardMessage) {
        dashboardMessage.textContent = error.message;
        dashboardMessage.classList.add('danger');
      }
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    clearAuth();
    window.location.href = 'login.html';
  });
}

loadDashboard();