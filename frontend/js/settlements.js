const settlementMessage = document.querySelector('[data-settlement-message]');
const settlementList = document.querySelector('[data-settlement-list]');
const createSettlementForm = document.querySelector('[data-create-settlement-form]');
const owedMembersSelect = document.querySelector('[data-owed-members]');

const currentUser = getUser();
const currentUserId = String(currentUser?.id || currentUser?._id || '');

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

const getUserId = (user) => String(user?._id || user?.id || '').trim();

const renderOwedMembers = (owedMembers) => {
  if (!owedMembersSelect) {
    return;
  }

  if (!owedMembers.length) {
    owedMembersSelect.innerHTML = '<option value="">No members to settle with</option>';
    owedMembersSelect.disabled = true;
    return;
  }

  owedMembersSelect.disabled = false;
  owedMembersSelect.innerHTML = '<option value="">Select member</option>';

  owedMembers.forEach((member) => {
    const option = document.createElement('option');
    option.value = member.username;
    option.textContent = `@${member.username} (${member.groupName} · due ${member.amount.toFixed(2)})`;
    option.dataset.groupId = member.groupId || '';
    owedMembersSelect.appendChild(option);
  });
};

const loadOwedMembers = async () => {
  if (!getUser()) {
    return;
  }

  try {
    const [groupsResponse, settlementsResponse] = await Promise.all([
      apiRequest('/groups'),
      apiRequest('/settlements'),
    ]);
    const owedByMember = new Map();
    const completedLegacyByMember = new Map();

    const summaries = await Promise.all(
      (groupsResponse.groups || []).map(async (group) => {
        try {
          const summaryResponse = await apiRequest(`/group/${group._id}/summary`);
          return {
            groupId: String(group._id),
            groupName: group.name,
            settlements: summaryResponse.settlements || [],
          };
        } catch (_error) {
          return {
            groupId: String(group._id),
            groupName: group.name,
            settlements: [],
          };
        }
      })
    );

    summaries.forEach((groupSummary) => {
      (groupSummary.settlements || []).forEach((settlement) => {
        const fromUserId = getUserId(settlement.fromUser);
        if (fromUserId !== currentUserId) {
          return;
        }

        const username = formatUserHandle(settlement.toUser);
        const amount = Number(settlement.amount || 0);
        if (!username || amount <= 0) {
          return;
        }

        const key = `${groupSummary.groupId}|${username}`;
        const existing = owedByMember.get(key) || {
          username,
          groupId: groupSummary.groupId,
          groupName: groupSummary.groupName,
          amount: 0,
        };

        existing.amount += amount;
        owedByMember.set(key, existing);
      });
    });

    (settlementsResponse.settlements || []).forEach((settlement) => {
      const fromUserId = getUserId(settlement.fromUser);
      if (fromUserId !== currentUserId) {
        return;
      }

      if (settlement.status !== 'completed') {
        return;
      }

      if (settlement.groupId) {
        return;
      }

      const username = formatUserHandle(settlement.toUser);
      const amount = Number(settlement.amount || 0);
      if (!username || amount <= 0) {
        return;
      }

      completedLegacyByMember.set(username, (completedLegacyByMember.get(username) || 0) + amount);
    });

    completedLegacyByMember.forEach((completedAmount, username) => {
      if (completedAmount <= 0) {
        return;
      }

      const matchingEntries = Array.from(owedByMember.values())
        .filter((entry) => entry.username === username)
        .sort((a, b) => b.amount - a.amount);

      let remaining = completedAmount;
      matchingEntries.forEach((entry) => {
        if (remaining <= 0) {
          return;
        }

        const used = Math.min(entry.amount, remaining);
        entry.amount -= used;
        remaining -= used;
      });
    });

    const owedMembers = Array.from(owedByMember.values())
      .filter((entry) => entry.amount > 0.009)
      .sort((a, b) => b.amount - a.amount);

    renderOwedMembers(owedMembers);
  } catch (_error) {
    renderOwedMembers([]);
  }
};

const renderSettlements = (settlements) => {
  if (!settlementList) {
    return;
  }

  if (!settlements.length) {
    settlementList.innerHTML = '<div class="list-item muted">No settlements recorded yet.</div>';
    return;
  }

  settlementList.innerHTML = settlements
    .map((settlement) => {
      const statusClass = settlement.status === 'completed' ? 'badge' : 'badge';
      const statusText = settlement.status === 'completed' ? 'Completed' : 'Pending';
      const fromUserId = String(settlement.fromUser?._id || settlement.fromUser?.id || '');
      const toUserId = String(settlement.toUser?._id || settlement.toUser?.id || '');
      const fromUserHandle = formatUserHandle(settlement.fromUser);
      const toUserHandle = formatUserHandle(settlement.toUser);
      const relationLine = fromUserId === currentUserId
        ? `You owe @${toUserHandle}`
        : toUserId === currentUserId
          ? `@${fromUserHandle} owes you`
          : `@${fromUserHandle} owes @${toUserHandle}`;
      const canMarkSettled = settlement.status === 'pending' && toUserId === currentUserId;
      const actionButton = canMarkSettled
        ? `<button class="button secondary" type="button" data-mark-settled="${settlement._id}">Mark settled</button>`
        : '';

      return `
        <div class="list-item">
          <strong>${relationLine}</strong>
          <div class="muted">Amount: ${Number(settlement.amount).toFixed(2)}</div>
          <div class="muted">Paid via: ${(settlement.paymentMethod || 'cash').toUpperCase()}</div>
          <div class="muted">Status: <span class="${statusClass}">${statusText}</span></div>
          ${settlement.groupId?.name ? `<div class="muted">Group: ${settlement.groupId.name}</div>` : ''}
          ${settlement.referenceId ? `<div class="muted">Reference: ${settlement.referenceId}</div>` : ''}
          <div class="form-actions" style="margin-top: 12px;">${actionButton}</div>
        </div>
      `;
    })
    .join('');
};

const loadSettlements = async () => {
  if (!getUser()) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const [response] = await Promise.all([
      apiRequest('/settlements'),
      loadOwedMembers(),
    ]);
    renderSettlements(response.settlements);
  } catch (error) {
    if (settlementMessage) {
      settlementMessage.textContent = error.message;
      settlementMessage.classList.add('danger');
    }
  }
};

if (settlementList) {
  settlementList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-mark-settled]');
    if (!button) {
      return;
    }

    const settlementId = button.dataset.markSettled;

    try {
      button.disabled = true;
      await apiRequest(`/settlements/${settlementId}/mark-settled`, {
        method: 'PATCH',
      });
      await loadSettlements();
    } catch (error) {
      if (settlementMessage) {
        settlementMessage.textContent = error.message;
        settlementMessage.classList.add('danger');
      }
    } finally {
      button.disabled = false;
    }
  });
}

if (createSettlementForm) {
  createSettlementForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const body = Object.fromEntries(new FormData(createSettlementForm).entries());
      body.toUsername = String(body.toUsername || '').trim().toLowerCase();
      body.paymentMethod = String(body.paymentMethod || 'cash').toLowerCase();

      const selectedOption = owedMembersSelect?.selectedOptions?.[0] || null;
      const selectedGroupId = String(selectedOption?.dataset?.groupId || '').trim();
      if (selectedGroupId) {
        body.groupId = selectedGroupId;
      }

      if (!body.toUsername) {
        throw new Error('Please select a member to settle with.');
      }

      await apiRequest('/settle', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      createSettlementForm.reset();
      if (settlementMessage) {
        settlementMessage.textContent = 'Payment recorded successfully.';
        settlementMessage.classList.remove('danger');
      }
      await loadSettlements();
    } catch (error) {
      if (settlementMessage) {
        settlementMessage.textContent = error.message;
        settlementMessage.classList.add('danger');
      }
    }
  });
}

loadSettlements();