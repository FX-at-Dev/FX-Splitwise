const groupTitle = document.querySelector('[data-group-title]');
const memberList = document.querySelector('[data-member-list]');
const splitMemberList = document.querySelector('[data-split-member-list]');
const expenseHistory = document.querySelector('[data-expense-history]');
const summaryList = document.querySelector('[data-summary-list]');
const addMemberForm = document.querySelector('[data-add-member-form]');
const addExpenseForm = document.querySelector('[data-add-expense-form]');
const groupNotice = document.querySelector('[data-group-notice]');

const params = new URLSearchParams(window.location.search);
const groupId = params.get('id');
const currentUserId = String(getUser()?.id || getUser()?._id || '');

const formatUserPrimaryLabel = (member) => {
  const username = String(member?.username || '').trim() || 'unknown';
  const name = String(member?.name || '').trim();
  return name ? `@${username} (${name})` : `@${username}`;
};

const getMemberBalanceMap = (balances = []) => {
  const map = new Map();
  balances.forEach((entry) => {
    const userId = String(entry?.user?._id || entry?.userId || '').trim();
    if (!userId) {
      return;
    }

    map.set(userId, Number(entry.balance || 0));
  });
  return map;
};

const renderSplitMemberOptions = (members = []) => {
  if (!splitMemberList) {
    return;
  }

  if (!members.length) {
    splitMemberList.innerHTML = '<div class="list-item muted">No members available for splitting.</div>';
    return;
  }

  splitMemberList.innerHTML = members
    .map((member) => `
      <label class="list-item split-member-item">
        <input type="checkbox" name="memberIds" value="${member._id}" checked />
        <span class="split-member-name">${formatUserPrimaryLabel(member)}</span>
      </label>
    `)
    .join('');
};

const loadGroup = async () => {
  if (!groupId) {
    window.location.href = 'dashboard.html';
    return;
  }

  try {
    const [groupResponse, summaryResponse] = await Promise.all([
      apiRequest(`/group/${groupId}`),
      apiRequest(`/group/${groupId}/summary`),
    ]);

    const group = groupResponse.group;
    const memberBalanceMap = getMemberBalanceMap(summaryResponse.balances || []);
    if (groupTitle) {
      groupTitle.textContent = group.name;
    }

    if (memberList) {
      memberList.innerHTML = group.members
        .map((member) => {
          const memberId = String(member._id || member.id || '');
          const canTarget = memberId && memberId !== currentUserId;
          const balance = Number(memberBalanceMap.get(memberId) || 0);
          const isZeroDebt = Math.abs(balance) <= 0.009;
          const balanceLabel = balance.toFixed(2);
          const removeHint = isZeroDebt
            ? '<span class="muted">Removable</span>'
            : '<span class="muted">Cannot remove until balance is 0.00</span>';
          const canRemove = canTarget && isZeroDebt;

          return `
            <div class="list-item">
              <strong>${formatUserPrimaryLabel(member)}</strong>
              <div class="muted">Balance: ${balanceLabel}</div>
              <div>${removeHint}</div>
              <div class="form-actions" style="margin-top: 10px;">
                ${canRemove ? `<button class="button secondary" type="button" data-remove-member="${memberId}">Remove</button>` : ''}
              </div>
            </div>
          `;
        })
        .join('');
    }

    renderSplitMemberOptions(group.members || []);

    if (expenseHistory) {
      expenseHistory.innerHTML = group.expenses.length
        ? group.expenses.map((expense) => `<div class="list-item"><strong>${expense.title}</strong><div class="muted">${expense.amount.toFixed(2)} paid by ${expense.paidBy.name}</div></div>`).join('')
        : '<div class="list-item muted">No group expenses yet.</div>';
    }

    if (summaryList) {
      summaryList.innerHTML = summaryResponse.settlements.length
        ? summaryResponse.settlements.map((item) => `<div class="list-item"><strong>${item.fromUser.name} → ${item.toUser.name}</strong><div class="muted">${item.amount.toFixed(2)}</div></div>`).join('')
        : '<div class="list-item muted">No debt simplification needed yet.</div>';
    }
  } catch (error) {
    if (groupNotice) {
      groupNotice.textContent = error.message;
      groupNotice.classList.add('danger');
    }
  }
};

if (addMemberForm) {
  addMemberForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const body = Object.fromEntries(new FormData(addMemberForm).entries());
      body.groupId = groupId;

      await apiRequest('/group/add-member', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      addMemberForm.reset();
      await loadGroup();
    } catch (error) {
      if (groupNotice) {
        groupNotice.textContent = error.message;
        groupNotice.classList.add('danger');
      }
    }
  });
}

if (memberList) {
  memberList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove-member]');
    if (!button) {
      return;
    }

    const memberId = button.dataset.removeMember;

    try {
      button.disabled = true;
      await apiRequest('/group/remove-member', {
        method: 'POST',
        body: JSON.stringify({ groupId, memberId }),
      });

      if (groupNotice) {
        groupNotice.textContent = 'Member removed successfully.';
        groupNotice.classList.remove('danger');
      }

      await loadGroup();
    } catch (error) {
      if (groupNotice) {
        groupNotice.textContent = error.message;
        groupNotice.classList.add('danger');
      }
    } finally {
      button.disabled = false;
    }
  });
}

if (addExpenseForm) {
  addExpenseForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const body = Object.fromEntries(new FormData(addExpenseForm).entries());
      const selectedMemberIds = Array.from(addExpenseForm.querySelectorAll('input[name="memberIds"]:checked'))
        .map((input) => input.value)
        .filter(Boolean);

      body.groupId = groupId;
      body.paidBy = getUser().id;
      body.splitType = 'equal';

      if (!selectedMemberIds.length) {
        throw new Error('Select at least one member for equal split.');
      }

      body.memberIds = selectedMemberIds;

      await apiRequest('/expense/add', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      addExpenseForm.reset();
      await loadGroup();
    } catch (error) {
      if (groupNotice) {
        groupNotice.textContent = error.message;
        groupNotice.classList.add('danger');
      }
    }
  });
}

loadGroup();