import { BellOff, Crown, LogOut, ShieldCheck, Trash2, UserCheck, UserRound, UsersRound } from 'lucide-react'

import { getGroupRoleLabel } from '@/services/messages/formatters'
import type { Conversation, FriendConnection } from '@/types'
import { cn } from '@/utils'
import styles from '../page.module.css'

type GroupLeader = { fullName: string; userId: number } | null

type ConversationDetailsPanelProps = {
  selectedConversation?: Conversation | null
  selectedGroup: Conversation | null
  rightPanelSection: 'overview' | 'members' | 'manage'
  setRightPanelSection: (value: 'overview' | 'members' | 'manage') => void
  myGroupRole: string | null
  groupLeader: GroupLeader
  groupDeputy: GroupLeader
  canManageRoles: boolean
  canRemoveMembers: boolean
  canAddMembers: boolean
  canDissolveSelectedGroup: boolean
  canLeaderLeaveGroup: boolean
  groupSearchKeyword: string
  setGroupSearchKeyword: (value: string) => void
  filteredGroupInviteCandidates: FriendConnection[]
  groupActionBusyId: string | null
  userId?: number
  handleClearChatForMe: () => void | Promise<void>
  handleTransferLeader: (userId: number) => void | Promise<void>
  handleSetDeputyRole: (userId: number | null) => void | Promise<void>
  handleRemoveMemberFromGroup: (userId: number) => void | Promise<void>
  handleAddMemberToGroup: (userId: number) => void | Promise<void>
  handleLeaveGroup: () => void | Promise<void>
  handleDissolveGroup: () => void | Promise<void>
}

export function ConversationDetailsPanel({
  selectedConversation,
  selectedGroup: selectedGroupProp,
  rightPanelSection,
  setRightPanelSection,
  myGroupRole,
  groupLeader,
  groupDeputy,
  canManageRoles,
  canRemoveMembers,
  canAddMembers,
  canDissolveSelectedGroup,
  canLeaderLeaveGroup,
  groupSearchKeyword,
  setGroupSearchKeyword,
  filteredGroupInviteCandidates,
  groupActionBusyId,
  userId,
  handleClearChatForMe,
  handleTransferLeader,
  handleSetDeputyRole,
  handleRemoveMemberFromGroup,
  handleAddMemberToGroup,
  handleLeaveGroup,
  handleDissolveGroup,
}: ConversationDetailsPanelProps) {
  const activeConversation = selectedConversation || selectedGroupProp
  const selectedGroup = activeConversation?.type === 'group' ? activeConversation : null

  if (!activeConversation) return null

  if (!selectedGroup) {
    const peer = activeConversation.members.find((member) => Number(member.userId) !== Number(userId))
    const displayName = peer?.fullName || activeConversation.name || 'Cuộc trò chuyện'
    return (
      <>
        <div className={styles.detailsIdentity}>
          <div className={styles.detailsAvatar}>
            <UserRound size={20} />
          </div>
          <div className={styles.detailsIdentityText}>
            <strong>{displayName}</strong>
            <small>Đoạn chat cá nhân</small>
          </div>
        </div>

        <div className={styles.detailsSection}>
          <strong>Cài đặt đoạn chat</strong>
          <div className={styles.groupMemberList}>
            <div className={styles.groupMemberRow}>
              <div className={styles.groupMemberInfo}>
                <b>Trạng thái</b>
                <small>Đang hoạt động hoặc vừa có tương tác gần đây</small>
              </div>
              <ShieldCheck size={15} />
            </div>
            <div className={styles.groupMemberRow}>
              <div className={styles.groupMemberInfo}>
                <b>Thông báo</b>
                <small>Quản lý thông báo cho cuộc trò chuyện này</small>
              </div>
              <BellOff size={15} />
            </div>
          </div>
        </div>

        <div className={styles.detailsSection}>
          <strong>Thao tác nhanh</strong>
          <div className={styles.detailActionsGrid}>
            <button type="button" onClick={() => void handleClearChatForMe()}>
              Xóa đoạn chat phía bạn
            </button>
          </div>
        </div>
      </>
    )
  }

  if (!selectedGroup) return null

  return (
    <>
      <div className={styles.detailsIdentity}>
        <div className={styles.detailsAvatar}>
          <UsersRound size={20} />
        </div>
        <div className={styles.detailsIdentityText}>
          <strong>{selectedGroup.name || 'Nhóm chat'}</strong>
          <small>Bạn: {getGroupRoleLabel(myGroupRole)}</small>
        </div>
      </div>

      <div className={styles.detailsTabs}>
        {(['overview', 'members', 'manage'] as const).map((section) => (
          <button
            key={section}
            type="button"
            className={cn(rightPanelSection === section && styles.detailsTabActive)}
            onClick={() => setRightPanelSection(section)}
          >
            {section === 'overview' ? 'Tổng quan' : section === 'members' ? 'Thành viên' : 'Quản lý'}
          </button>
        ))}
      </div>

      {rightPanelSection === 'overview' ? (
        <>
          <div className={styles.detailsSection}>
            <strong>Vai trò chính</strong>
            <div className={styles.groupMemberList}>
              <div className={styles.groupMemberRow}>
                <div className={styles.groupMemberInfo}>
                  <b>{groupLeader?.fullName || 'Chưa xác định'}</b>
                  <small>Trưởng nhóm - ID {groupLeader?.userId ?? selectedGroup.createdBy}</small>
                </div>
                <Crown size={14} />
              </div>
              <div className={styles.groupMemberRow}>
                <div className={styles.groupMemberInfo}>
                  <b>{groupDeputy?.fullName || 'Chưa có phó nhóm'}</b>
                  <small>{groupDeputy ? `Phó nhóm - ID ${groupDeputy.userId}` : 'Cần chỉ định để trưởng nhóm có thể rời nhóm'}</small>
                </div>
                <UserCheck size={14} />
              </div>
            </div>
          </div>

          <div className={styles.detailsSection}>
            <strong>Thao tác nhanh</strong>
            <div className={styles.detailActionsGrid}>
              <button type="button" onClick={() => setRightPanelSection('manage')}>
                Quản lý quyền & thành viên
              </button>
              <button type="button" onClick={() => void handleClearChatForMe()}>
                Xóa đoạn chat phía bạn
              </button>
            </div>
          </div>
        </>
      ) : null}

      {rightPanelSection === 'members' ? (
        <div className={styles.detailsSection}>
          <strong>Danh sách thành viên ({selectedGroup.members.length})</strong>
          <div className={styles.groupMemberList}>
            {selectedGroup.members.map((member) => (
              <div key={member.userId} className={styles.groupMemberRow}>
                <div className={styles.groupMemberInfo}>
                  <b>{member.fullName}{Number(member.userId) === Number(userId) ? ' (Bạn)' : ''}</b>
                  <small>{getGroupRoleLabel(member.role)} - ID {member.userId}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {rightPanelSection === 'manage' ? (
        <>
          <p className={styles.groupManageHint}>
            {canManageRoles
              ? 'Bạn là trưởng nhóm: có thể phân quyền, thêm/xóa thành viên, giải tán nhóm và rời nhóm.'
              : canRemoveMembers
                ? 'Bạn là phó nhóm: có thể thêm/xóa thành viên.'
                : 'Bạn là thành viên: chỉ có thể rời nhóm.'}
          </p>
          <div className={styles.detailsSection}>
            <strong>Quản lý thành viên hiện tại</strong>
            <div className={styles.groupMemberList}>
              {selectedGroup.members.map((member) => {
                const isSelf = Number(member.userId) === Number(userId)
                const isLeader = member.role === 'leader'
                const isDeputy = member.role === 'deputy'
                return (
                  <div key={member.userId} className={styles.groupMemberRow}>
                    <div className={styles.groupMemberInfo}>
                      <b>{member.fullName}{isSelf ? ' (Bạn)' : ''}</b>
                      <small>{getGroupRoleLabel(member.role)} - ID {member.userId}</small>
                    </div>
                    {(canManageRoles || canRemoveMembers) && !isSelf ? (
                      <div className={styles.groupMemberActions}>
                        {canManageRoles && !isLeader ? (
                          <button type="button" disabled={groupActionBusyId === `role-${member.userId}`} onClick={() => void handleTransferLeader(member.userId)}>
                            {groupActionBusyId === `role-${member.userId}` ? 'Đang chuyển...' : 'Làm trưởng nhóm'}
                          </button>
                        ) : null}
                        {canManageRoles && !isLeader ? (
                          <button type="button" disabled={groupActionBusyId === `deputy-${isDeputy ? 'none' : member.userId}`} onClick={() => void handleSetDeputyRole(isDeputy ? null : member.userId)}>
                            {groupActionBusyId === `deputy-${isDeputy ? 'none' : member.userId}` ? 'Đang cập nhật...' : isDeputy ? 'Gỡ phó nhóm' : 'Gán phó nhóm'}
                          </button>
                        ) : null}
                        <button type="button" className={styles.dangerBtn} disabled={groupActionBusyId === `remove-${member.userId}`} onClick={() => void handleRemoveMemberFromGroup(member.userId)}>
                          {groupActionBusyId === `remove-${member.userId}` ? 'Đang xóa...' : 'Xóa'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {canAddMembers ? (
            <div className={styles.detailsSection}>
              <strong>Thêm thành viên</strong>
              <input className={styles.detailsSearchInput} value={groupSearchKeyword} onChange={(event) => setGroupSearchKeyword(event.target.value)} placeholder="Tìm bạn bè theo tên, email hoặc ID" />
              <div className={styles.groupMemberList}>
                {filteredGroupInviteCandidates.map((friend) => (
                  <div key={friend.id} className={styles.groupMemberRow}>
                    <div className={styles.groupMemberInfo}>
                      <b>{friend.fullName}</b>
                      <small>{friend.email || friend.phone || `ID ${friend.id}`}</small>
                    </div>
                    <button type="button" disabled={groupActionBusyId === `add-${friend.id}`} onClick={() => void handleAddMemberToGroup(friend.id)}>
                      {groupActionBusyId === `add-${friend.id}` ? 'Đang thêm...' : 'Thêm'}
                    </button>
                  </div>
                ))}
                {filteredGroupInviteCandidates.length === 0 ? <p className={styles.groupManageHint}>Không còn bạn bè phù hợp để thêm.</p> : null}
              </div>
            </div>
          ) : null}

          <div className={styles.detailsSection}>
            <strong>Hành động nhóm</strong>
            <div className={styles.detailActionsGrid}>
              <button type="button" className={styles.dangerBtn} disabled={groupActionBusyId === 'leave-group' || (myGroupRole === 'leader' && !canLeaderLeaveGroup)} onClick={() => void handleLeaveGroup()}>
                <LogOut size={14} />
                {groupActionBusyId === 'leave-group' ? 'Đang rời nhóm...' : 'Rời nhóm'}
              </button>
              {canDissolveSelectedGroup ? (
                <button type="button" className={styles.dangerBtn} disabled={groupActionBusyId === 'dissolve-group'} onClick={() => void handleDissolveGroup()}>
                  <Trash2 size={14} />
                  {groupActionBusyId === 'dissolve-group' ? 'Đang giải tán...' : 'Giải tán nhóm'}
                </button>
              ) : null}
            </div>
            {myGroupRole === 'leader' && !canLeaderLeaveGroup ? <small>Trưởng nhóm chỉ có thể rời nhóm sau khi đã có phó nhóm.</small> : null}
          </div>
        </>
      ) : null}
    </>
  )
}
