import { Crown, LogOut, Trash2, UserCheck } from 'lucide-react'

import { getGroupRoleLabel } from '@/services/messages/formatters'
import type { Conversation, FriendConnection } from '@/types'
import { cn } from '@/utils'

type GroupLeader = { fullName: string; userId: number } | null

type ConversationDetailsPanelProps = {
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

const sectionClass = 'grid gap-2 rounded-xl border border-slate-300/60 bg-white p-3'
const memberRowClass = 'flex min-h-11 items-center justify-between gap-2 rounded-[9px] bg-slate-100 px-3 py-2'
const subtleButton = 'inline-flex min-h-8 items-center justify-center rounded-lg bg-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50'
const dangerButton = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 text-xs font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50'

export function ConversationDetailsPanel({
  selectedGroup,
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
  if (!selectedGroup) return null

  return (
    <>
      <div className="flex items-center gap-2 rounded-xl border border-slate-300/60 bg-white p-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-base font-extrabold text-white">{(selectedGroup.name?.[0] || 'G').toUpperCase()}</div>
        <div className="min-w-0">
          <strong className="block truncate text-sm text-slate-800">{selectedGroup.name || 'Nhom chat'}</strong>
          <small className="text-xs text-slate-500">Ban: {getGroupRoleLabel(myGroupRole)}</small>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-slate-200 p-1">
        {(['overview', 'members', 'manage'] as const).map((section) => (
          <button
            key={section}
            type="button"
            className={cn('min-h-8 rounded-lg text-xs font-bold text-slate-600', rightPanelSection === section && 'bg-white text-blue-800 shadow-sm')}
            onClick={() => setRightPanelSection(section)}
          >
            {section === 'overview' ? 'Tong quan' : section === 'members' ? 'Thanh vien' : 'Quan ly'}
          </button>
        ))}
      </div>

      {rightPanelSection === 'overview' ? (
        <>
          <div className={sectionClass}>
            <strong className="text-sm text-slate-800">Vai tro chinh</strong>
            <div className="grid max-h-[200px] gap-1.5 overflow-y-auto">
              <div className={memberRowClass}>
                <div className="grid min-w-0 gap-0.5">
                  <b className="truncate text-sm text-slate-800">{groupLeader?.fullName || 'Chua xac dinh'}</b>
                  <small className="truncate text-xs text-slate-500">Truong nhom - ID {groupLeader?.userId ?? selectedGroup.createdBy}</small>
                </div>
                <Crown size={14} />
              </div>
              <div className={memberRowClass}>
                <div className="grid min-w-0 gap-0.5">
                  <b className="truncate text-sm text-slate-800">{groupDeputy?.fullName || 'Chua co pho nhom'}</b>
                  <small className="truncate text-xs text-slate-500">{groupDeputy ? `Pho nhom - ID ${groupDeputy.userId}` : 'Can chi dinh de truong nhom co the roi nhom'}</small>
                </div>
                <UserCheck size={14} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <strong className="text-sm text-slate-800">Thao tac nhanh</strong>
            <div className="grid gap-1.5">
              <button type="button" className={subtleButton} onClick={() => setRightPanelSection('manage')}>
                Quan ly quyen & thanh vien
              </button>
              <button type="button" className={subtleButton} onClick={() => void handleClearChatForMe()}>
                Xoa doan chat phia ban
              </button>
            </div>
          </div>
        </>
      ) : null}

      {rightPanelSection === 'members' ? (
        <div className={sectionClass}>
          <strong className="text-sm text-slate-800">Danh sach thanh vien ({selectedGroup.members.length})</strong>
          <div className="grid max-h-[200px] gap-1.5 overflow-y-auto">
            {selectedGroup.members.map((member) => (
              <div key={member.userId} className={memberRowClass}>
                <div className="grid min-w-0 gap-0.5">
                  <b className="truncate text-sm text-slate-800">{member.fullName}{Number(member.userId) === Number(userId) ? ' (Ban)' : ''}</b>
                  <small className="truncate text-xs text-slate-500">{getGroupRoleLabel(member.role)} - ID {member.userId}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {rightPanelSection === 'manage' ? (
        <>
          <p className="m-0 text-sm text-slate-500">
            {canManageRoles
              ? 'Ban la truong nhom: co the phan quyen, them/xoa thanh vien, giai tan nhom va roi nhom.'
              : canRemoveMembers
                ? 'Ban la pho nhom: co the them/xoa thanh vien.'
                : 'Ban la thanh vien: chi co the roi nhom.'}
          </p>
          <div className={sectionClass}>
            <strong className="text-sm text-slate-800">Quan ly thanh vien hien tai</strong>
            <div className="grid max-h-[200px] gap-1.5 overflow-y-auto">
              {selectedGroup.members.map((member) => {
                const isSelf = Number(member.userId) === Number(userId)
                const isLeader = member.role === 'leader'
                const isDeputy = member.role === 'deputy'
                return (
                  <div key={member.userId} className={memberRowClass}>
                    <div className="grid min-w-0 gap-0.5">
                      <b className="truncate text-sm text-slate-800">{member.fullName}{isSelf ? ' (Ban)' : ''}</b>
                      <small className="truncate text-xs text-slate-500">{getGroupRoleLabel(member.role)} - ID {member.userId}</small>
                    </div>
                    {(canManageRoles || canRemoveMembers) && !isSelf ? (
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {canManageRoles && !isLeader ? (
                          <button type="button" className={subtleButton} disabled={groupActionBusyId === `role-${member.userId}`} onClick={() => void handleTransferLeader(member.userId)}>
                            {groupActionBusyId === `role-${member.userId}` ? 'Dang chuyen...' : 'Lam truong nhom'}
                          </button>
                        ) : null}
                        {canManageRoles && !isLeader ? (
                          <button type="button" className={subtleButton} disabled={groupActionBusyId === `deputy-${isDeputy ? 'none' : member.userId}`} onClick={() => void handleSetDeputyRole(isDeputy ? null : member.userId)}>
                            {groupActionBusyId === `deputy-${isDeputy ? 'none' : member.userId}` ? 'Dang cap nhat...' : isDeputy ? 'Go pho nhom' : 'Gan pho nhom'}
                          </button>
                        ) : null}
                        <button type="button" className={dangerButton} disabled={groupActionBusyId === `remove-${member.userId}`} onClick={() => void handleRemoveMemberFromGroup(member.userId)}>
                          {groupActionBusyId === `remove-${member.userId}` ? 'Dang xoa...' : 'Xoa'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {canAddMembers ? (
            <div className={sectionClass}>
              <strong className="text-sm text-slate-800">Them thanh vien</strong>
              <input className="min-h-9 rounded-[9px] border border-slate-300 px-3 text-sm outline-none focus:border-primary" value={groupSearchKeyword} onChange={(event) => setGroupSearchKeyword(event.target.value)} placeholder="Tim ban be theo ten, email hoac ID" />
              <div className="grid max-h-[200px] gap-1.5 overflow-y-auto">
                {filteredGroupInviteCandidates.map((friend) => (
                  <div key={friend.id} className={memberRowClass}>
                    <div className="grid min-w-0 gap-0.5">
                      <b className="truncate text-sm text-slate-800">{friend.fullName}</b>
                      <small className="truncate text-xs text-slate-500">{friend.email || friend.phone || `ID ${friend.id}`}</small>
                    </div>
                    <button type="button" className={subtleButton} disabled={groupActionBusyId === `add-${friend.id}`} onClick={() => void handleAddMemberToGroup(friend.id)}>
                      {groupActionBusyId === `add-${friend.id}` ? 'Dang them...' : 'Them'}
                    </button>
                  </div>
                ))}
                {filteredGroupInviteCandidates.length === 0 ? <p className="m-0 text-sm text-slate-500">Khong con ban be phu hop de them.</p> : null}
              </div>
            </div>
          ) : null}

          <div className={sectionClass}>
            <strong className="text-sm text-slate-800">Hanh dong nhom</strong>
            <div className="grid gap-1.5">
              <button type="button" className={dangerButton} disabled={groupActionBusyId === 'leave-group' || (myGroupRole === 'leader' && !canLeaderLeaveGroup)} onClick={() => void handleLeaveGroup()}>
                <LogOut size={14} />
                {groupActionBusyId === 'leave-group' ? 'Dang roi nhom...' : 'Roi nhom'}
              </button>
              {canDissolveSelectedGroup ? (
                <button type="button" className={dangerButton} disabled={groupActionBusyId === 'dissolve-group'} onClick={() => void handleDissolveGroup()}>
                  <Trash2 size={14} />
                  {groupActionBusyId === 'dissolve-group' ? 'Dang giai tan...' : 'Giai tan nhom'}
                </button>
              ) : null}
            </div>
            {myGroupRole === 'leader' && !canLeaderLeaveGroup ? <small className="text-xs text-slate-500">Truong nhom chi co the roi nhom sau khi da co pho nhom.</small> : null}
          </div>
        </>
      ) : null}
    </>
  )
}
