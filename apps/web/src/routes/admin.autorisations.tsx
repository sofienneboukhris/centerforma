import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  KeyRound,
  Plus,
  Trash2,
  Edit,
  Lock,
  CheckCircle2,
  XCircle,
  History,
  UserPlus,
  Info,
  Search,
  AlertTriangle,
  FolderLock,
  Layers,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  setRolePermissions,
  fetchGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  setGroupPermissions,
  setGroupRoles,
  addGroupMembers,
  removeGroupMember,
  fetchPermissions,
  fetchUsersWithAuth,
  assignRoleToUser,
  revokeRoleFromUser,
  fetchEffectivePermissions,
  fetchAuditLogs,
  type RoleItem,
  type GroupItem,
  type PermissionItem,
  type UserAuthItem,
  type EffectivePermissions,
} from "@/services/autorisations";

export const Route = createFileRoute("/admin/autorisations")({
  component: AdminAutorisationsPage,
  head: () => ({
    meta: [
      { title: "Rôles & Permissions | FormaCenter" },
      {
        name: "description",
        content: "Module exclusif du Super Administrateur pour la gestion des rôles, groupes et permissions.",
      },
    ],
  }),
});

function AdminAutorisationsPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  // Protection stricte côté client
  if (role !== "super_admin") {
    return <Navigate to="/acces-refuse" replace />;
  }

  const [activeTab, setActiveTab] = useState("roles");

  // Requêtes de données
  const { data: roles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: fetchRoles,
  });

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["admin", "groups"],
    queryFn: fetchGroups,
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: fetchPermissions,
  });

  const [userSearch, setUserSearch] = useState("");
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["admin", "users-auth", userSearch],
    queryFn: () => fetchUsersWithAuth(userSearch),
  });

  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: () => fetchAuditLogs(50),
    enabled: activeTab === "audit",
  });

  // États pour les modales
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [roleCode, setRoleCode] = useState("");
  const [roleNom, setRoleNom] = useState("");
  const [roleDesc, setRoleDesc] = useState("");

  const [rolePermModalOpen, setRolePermModalOpen] = useState(false);
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<RoleItem | null>(null);
  const [selectedRolePermCodes, setSelectedRolePermCodes] = useState<string[]>([]);

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [groupNom, setGroupNom] = useState("");
  const [groupDesc, setGroupDesc] = useState("");

  const [groupPermModalOpen, setGroupPermModalOpen] = useState(false);
  const [selectedGroupForPerms, setSelectedGroupForPerms] = useState<GroupItem | null>(null);
  const [groupPermsConfig, setGroupPermsConfig] = useState<Record<string, "allow" | "deny" | "none">>({});

  const [groupRolesModalOpen, setGroupRolesModalOpen] = useState(false);
  const [selectedGroupForRoles, setSelectedGroupForRoles] = useState<GroupItem | null>(null);
  const [selectedGroupRoleIds, setSelectedGroupRoleIds] = useState<string[]>([]);

  const [inspectUserModalOpen, setInspectUserModalOpen] = useState(false);
  const [inspectingUserId, setInspectingUserId] = useState<string | null>(null);
  const { data: effectivePerms, isLoading: loadingEffective } = useQuery({
    queryKey: ["admin", "effective-permissions", inspectingUserId],
    queryFn: () => fetchEffectivePermissions(inspectingUserId!),
    enabled: !!inspectingUserId && inspectUserModalOpen,
  });

  const [assignRoleModalOpen, setAssignRoleModalOpen] = useState(false);
  const [selectedUserForAssign, setSelectedUserForAssign] = useState<UserAuthItem | null>(null);

  // Groupement des permissions par module
  const permissionsByModule = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {} as Record<string, PermissionItem[]>);

  // Mutations
  const createRoleMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      toast.success("Rôle personnalisé créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      setRoleModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erreur de création de rôle"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateRole(id, data),
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      setRoleModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erreur de modification"),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      toast.success("Rôle supprimé");
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: (err: any) => toast.error(err.message || "Erreur de suppression"),
  });

  const setRolePermsMutation = useMutation({
    mutationFn: ({ id, perms }: { id: string; perms: any[] }) => setRolePermissions(id, perms),
    onSuccess: () => {
      toast.success("Permissions du rôle mises à jour");
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "effective-permissions"] });
      setRolePermModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erreur d'enregistrement"),
  });

  const createGroupMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      toast.success("Groupe créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      setGroupModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erreur de création du groupe"),
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateGroup(id, data),
    onSuccess: () => {
      toast.success("Groupe mis à jour");
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      setGroupModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erreur de modification"),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      toast.success("Groupe supprimé");
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
    },
    onError: (err: any) => toast.error(err.message || "Erreur de suppression"),
  });

  const setGroupPermsMutation = useMutation({
    mutationFn: ({ id, perms }: { id: string; perms: any[] }) => setGroupPermissions(id, perms),
    onSuccess: () => {
      toast.success("Permissions du groupe enregistrées");
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "effective-permissions"] });
      setGroupPermModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erreur"),
  });

  const setGroupRolesMutation = useMutation({
    mutationFn: ({ id, roleIds }: { id: string; roleIds: string[] }) => setGroupRoles(id, roleIds),
    onSuccess: () => {
      toast.success("Rôles du groupe mis à jour");
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      setGroupRolesModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erreur"),
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      assignRoleToUser(userId, roleId),
    onSuccess: () => {
      toast.success("Rôle attribué à l'utilisateur");
      queryClient.invalidateQueries({ queryKey: ["admin", "users-auth"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: (err: any) => toast.error(err.message || "Erreur d'attribution"),
  });

  const revokeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      revokeRoleFromUser(userId, roleId),
    onSuccess: () => {
      toast.success("Rôle révoqué avec succès");
      queryClient.invalidateQueries({ queryKey: ["admin", "users-auth"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: (err: any) => toast.error(err.message || "Erreur de révocation"),
  });

  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleCode("");
    setRoleNom("");
    setRoleDesc("");
    setRoleModalOpen(true);
  };

  const handleOpenEditRole = (r: RoleItem) => {
    setEditingRole(r);
    setRoleCode(r.code);
    setRoleNom(r.nom);
    setRoleDesc(r.description || "");
    setRoleModalOpen(true);
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole) {
      updateRoleMutation.mutate({
        id: editingRole.id,
        data: { nom: roleNom, description: roleDesc },
      });
    } else {
      createRoleMutation.mutate({
        code: roleCode,
        nom: roleNom,
        description: roleDesc,
      });
    }
  };

  const handleOpenRolePerms = (r: RoleItem) => {
    setSelectedRoleForPerms(r);
    setSelectedRolePermCodes(r.permissions.filter((p) => p.granted).map((p) => p.code));
    setRolePermModalOpen(true);
  };

  const handleSaveRolePerms = () => {
    if (!selectedRoleForPerms) return;
    const perms = selectedRolePermCodes.map((code) => ({
      permission_code: code,
      granted: true,
    }));
    setRolePermsMutation.mutate({ id: selectedRoleForPerms.id, perms });
  };

  const handleOpenCreateGroup = () => {
    setEditingGroup(null);
    setGroupNom("");
    setGroupDesc("");
    setGroupModalOpen(true);
  };

  const handleOpenEditGroup = (g: GroupItem) => {
    setEditingGroup(g);
    setGroupNom(g.nom);
    setGroupDesc(g.description || "");
    setGroupModalOpen(true);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGroup) {
      updateGroupMutation.mutate({
        id: editingGroup.id,
        data: { nom: groupNom, description: groupDesc },
      });
    } else {
      createGroupMutation.mutate({
        nom: groupNom,
        description: groupDesc,
      });
    }
  };

  const handleOpenGroupPerms = (g: GroupItem) => {
    setSelectedGroupForPerms(g);
    const cfg: Record<string, "allow" | "deny" | "none"> = {};
    for (const p of g.permissions) {
      cfg[p.code] = p.granted ? "allow" : "deny";
    }
    setGroupPermsConfig(cfg);
    setGroupPermModalOpen(true);
  };

  const handleSaveGroupPerms = () => {
    if (!selectedGroupForPerms) return;
    const perms = Object.entries(groupPermsConfig)
      .filter(([_, val]) => val === "allow" || val === "deny")
      .map(([code, val]) => ({
        permission_code: code,
        granted: val === "allow",
      }));
    setGroupPermsMutation.mutate({ id: selectedGroupForPerms.id, perms });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Rôles, Groupes et Permissions"
        subtitle="Console de sécurité réservée au Super Administrateur pour configurer les habilitations, les groupes et tracer les accès."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Rôles Définis"
          value={roles.length}
          helperText={`${roles.filter((r) => r.is_system).length} système, ${roles.filter((r) => !r.is_system).length} personnalisés`}
          icon={ShieldCheck}
        />
        <StatCard
          label="Groupes d'Utilisateurs"
          value={groups.length}
          helperText={`${groups.reduce((acc, g) => acc + g.membersCount, 0)} affectations membres`}
          icon={Users}
        />
        <StatCard
          label="Permissions Système"
          value={permissions.length}
          helperText="Catalogue canonique par modules"
          icon={KeyRound}
        />
        <StatCard
          label="Utilisateurs Gérés"
          value={users.length}
          helperText="Comptes avec traçabilité RBAC"
          icon={Layers}
        />
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/90">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <span className="font-semibold text-primary">Règle de Priorité de Sécurité :</span>{" "}
            Toute interdiction explicite configurée au niveau d'un groupe (
            <Badge variant="destructive" className="mx-1 text-xs">Explicit Deny</Badge>
            ) l'emporte toujours sur les permissions accordées par les rôles. Le rôle{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold text-foreground">
              super_admin
            </code>{" "}
            dispose d'un droit permanent et inconditionnel sur l'ensemble de la plateforme. Les rôles{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold text-foreground">
              enseignant
            </code>{" "}
            et{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold text-foreground">
              etudiant
            </code>{" "}
            sont verrouillés et protégés contre toute altération.
          </div>
        </div>
      </div>

      {/* Onglets principaux */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Rôles ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="groupes" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Groupes ({groups.length})
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Catalogue Permissions ({permissions.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Affectations & Droits Effectifs
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Journal d'Audit Sécurité
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* ONGLET 1 : RÔLES                                                 */}
        {/* ================================================================= */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Rôles Système et Personnalisés</h3>
            <Button onClick={handleOpenCreateRole} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nouveau Rôle Personnalisé
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Code / Nom</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Permissions</th>
                  <th className="px-4 py-3">Utilisateurs</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingRoles ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Chargement des rôles…
                    </td>
                  </tr>
                ) : (
                  roles.map((r) => {
                    const isProtected = ["super_admin", "enseignant", "etudiant"].includes(r.code);
                    return (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{r.nom}</div>
                          <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                          {r.description || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {r.is_system ? (
                            <Badge variant="secondary" className="flex w-fit items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Système
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-primary/40 text-primary">
                              Personnalisé
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.code === "super_admin" ? (
                            <Badge className="bg-emerald-600">Toutes (Immuable)</Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary"
                              disabled={isProtected}
                              onClick={() => handleOpenRolePerms(r)}
                            >
                              <KeyRound className="mr-1 h-3 w-3" />
                              {r.permissionsCount} permission(s)
                            </Button>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {r.usersCount} utilisateur(s)
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isProtected && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleOpenEditRole(r)}
                                  title="Modifier le rôle"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {!r.is_system && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      if (confirm(`Supprimer définitivement le rôle '${r.nom}' ?`)) {
                                        deleteRoleMutation.mutate(r.id);
                                      }
                                    }}
                                    title="Supprimer le rôle"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                            {isProtected && (
                              <span className="flex items-center text-xs text-muted-foreground">
                                <Lock className="mr-1 h-3.5 w-3.5" /> Intouchable
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* ONGLET 2 : GROUPES                                               */}
        {/* ================================================================= */}
        <TabsContent value="groupes" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Groupes d'Utilisateurs</h3>
            <Button onClick={handleOpenCreateGroup} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nouveau Groupe
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loadingGroups ? (
              <p className="col-span-full py-8 text-center text-muted-foreground">
                Chargement des groupes…
              </p>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-sm">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground">{g.nom}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {g.description || "Aucune description"}
                        </p>
                      </div>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {g.membersCount} membre(s)
                      </Badge>
                    </div>

                    <div className="border-t pt-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Permissions Spécifiques
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {g.permissions.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Aucune permission directe</span>
                        ) : (
                          g.permissions.map((p) => (
                            <Badge
                              key={p.code}
                              variant={p.granted ? "secondary" : "destructive"}
                              className="text-[11px]"
                            >
                              {p.granted ? `+ ${p.code}` : `- ${p.code} (Refus)`}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t pt-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleOpenGroupPerms(g)}
                      >
                        <KeyRound className="mr-1 h-3.5 w-3.5" />
                        Permissions
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleOpenEditGroup(g)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Supprimer le groupe '${g.nom}' ?`)) {
                          deleteGroupMutation.mutate(g.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* ONGLET 3 : CATALOGUE DES PERMISSIONS                             */}
        {/* ================================================================= */}
        <TabsContent value="permissions" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Catalogue des Permissions Système</h3>
            <Badge variant="outline" className="border-primary/40 text-primary">
              {permissions.length} actions gérées
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Object.entries(permissionsByModule).map(([moduleName, perms]) => (
              <div key={moduleName} className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <h4 className="font-semibold uppercase tracking-wider text-primary">
                    Module : {moduleName}
                  </h4>
                  <Badge variant="secondary" className="text-xs">
                    {perms.length} droit(s)
                  </Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {perms.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-start justify-between rounded-lg border bg-muted/20 p-2.5 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-foreground">{p.code}</span>
                        <p className="mt-0.5 text-muted-foreground">{p.description}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {p.action}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* ONGLET 4 : AFFECTATIONS & DROITS EFFECTIFS                        */}
        {/* ================================================================= */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold">Utilisateurs et Permissions Effectives</h3>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher nom, email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rôles Attribués</th>
                  <th className="px-4 py-3">Groupes</th>
                  <th className="px-4 py-3 text-right">Contrôle & Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Chargement des utilisateurs…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {u.nom} {u.prenom || ""}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <Badge
                              key={r}
                              variant={r === "super_admin" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.groups.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            u.groups.map((g) => (
                              <Badge key={g.id} variant="outline" className="text-xs">
                                {g.nom}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              setSelectedUserForAssign(u);
                              setAssignRoleModalOpen(true);
                            }}
                          >
                            Affecter Rôle
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 text-xs font-semibold text-primary"
                            onClick={() => {
                              setInspectingUserId(u.id);
                              setInspectUserModalOpen(true);
                            }}
                          >
                            <KeyRound className="mr-1 h-3.5 w-3.5" />
                            Droits Réels
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* ONGLET 5 : JOURNAL D'AUDIT SÉCURITÉ                              */}
        {/* ================================================================= */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Historique d'Audit des Autorisations</h3>
            <span className="text-xs text-muted-foreground">Source : table audit_log</span>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date / Heure</th>
                  <th className="px-4 py-3">Auteur</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Cible</th>
                  <th className="px-4 py-3">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-xs">
                {loadingAudit ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground font-sans">
                      Chargement du journal d'audit…
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground font-sans">
                      Aucune modification d'autorisation enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 font-sans font-medium text-foreground">
                        {log.user?.nom || log.user?.email || "Système"}
                      </td>
                      <td className="px-4 py-3 font-bold text-primary">{log.action}</td>
                      <td className="px-4 py-3 text-muted-foreground">{log.table_name || "—"}</td>
                      <td className="max-w-md truncate px-4 py-3 text-muted-foreground">
                        {log.payload ? JSON.stringify(log.payload) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* =================================================================== */}
      {/* MODALE : CRÉER / MODIFIER UN RÔLE                                   */}
      {/* =================================================================== */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? `Modifier le rôle : ${editingRole.nom}` : "Créer un rôle personnalisé"}
            </DialogTitle>
            <DialogDescription>
              Définissez les propriétés de ce rôle. Seul le super_admin peut effectuer cette opération.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRole} className="space-y-4 py-2">
            {!editingRole && (
              <div className="space-y-1.5">
                <Label htmlFor="roleCode">Code identifiant unique</Label>
                <Input
                  id="roleCode"
                  placeholder="ex: secretaire, surveillant, comptable_junior"
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value)}
                  required
                />
                <span className="text-[11px] text-muted-foreground">
                  Lettres minuscules, chiffres, tirets ou underscores uniquement.
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="roleNom">Nom usuel</Label>
              <Input
                id="roleNom"
                placeholder="ex: Secrétaire d'accueil"
                value={roleNom}
                onChange={(e) => setRoleNom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roleDesc">Description / Rôle métier</Label>
              <Input
                id="roleDesc"
                placeholder="ex: Gestion des inscriptions et consultations administratives"
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRoleModalOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
              >
                {editingRole ? "Enregistrer" : "Créer le rôle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODALE : PERMISSIONS D'UN RÔLE                                      */}
      {/* =================================================================== */}
      <Dialog open={rolePermModalOpen} onOpenChange={setRolePermModalOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissions du rôle : {selectedRoleForPerms?.nom}</DialogTitle>
            <DialogDescription>
              Cochez les permissions accordées à ce rôle. Elles seront automatiquement héritées par
              les utilisateurs affectés.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-3">
            {Object.entries(permissionsByModule).map(([moduleName, perms]) => (
              <div key={moduleName} className="rounded-lg border bg-card p-4">
                <h5 className="font-semibold uppercase tracking-wider text-primary text-xs border-b pb-2">
                  Module : {moduleName}
                </h5>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {perms.map((p) => {
                    const isChecked = selectedRolePermCodes.includes(p.code);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-colors cursor-pointer ${
                          isChecked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRolePermCodes([...selectedRolePermCodes, p.code]);
                            } else {
                              setSelectedRolePermCodes(
                                selectedRolePermCodes.filter((c) => c !== p.code)
                              );
                            }
                          }}
                          className="mt-0.5 rounded border-gray-300 text-primary"
                        />
                        <div>
                          <div className="font-mono font-bold text-foreground">{p.code}</div>
                          <div className="text-muted-foreground">{p.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRolePermModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveRolePerms} disabled={setRolePermsMutation.isPending}>
              Enregistrer les permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODALE : CRÉER / MODIFIER UN GROUPE                                 */}
      {/* =================================================================== */}
      <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? `Modifier le groupe : ${editingGroup.nom}` : "Créer un groupe d'utilisateurs"}
            </DialogTitle>
            <DialogDescription>
              Un groupe permet d'organiser les utilisateurs et de leur assigner collectivement des
              droits ou des interdictions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveGroup} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="groupNom">Nom du groupe</Label>
              <Input
                id="groupNom"
                placeholder="ex: Administration, Comptabilité, Surveillance"
                value={groupNom}
                onChange={(e) => setGroupNom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="groupDesc">Description</Label>
              <Input
                id="groupDesc"
                placeholder="ex: Personnel chargé du secrétariat et accueil"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGroupModalOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createGroupMutation.isPending || updateGroupMutation.isPending}
              >
                {editingGroup ? "Enregistrer" : "Créer le groupe"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODALE : PERMISSIONS D'UN GROUPE (AVEC EXPLICIT DENY)               */}
      {/* =================================================================== */}
      <Dialog open={groupPermModalOpen} onOpenChange={setGroupPermModalOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissions du groupe : {selectedGroupForPerms?.nom}</DialogTitle>
            <DialogDescription>
              Vous pouvez accorder une permission ou définir une{" "}
              <strong className="text-destructive">interdiction explicite (Explicit Deny)</strong>{" "}
              qui prévaudra sur tout rôle attribué à l'utilisateur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-3">
            {Object.entries(permissionsByModule).map(([moduleName, perms]) => (
              <div key={moduleName} className="rounded-lg border bg-card p-4">
                <h5 className="font-semibold uppercase tracking-wider text-primary text-xs border-b pb-2">
                  Module : {moduleName}
                </h5>
                <div className="mt-3 space-y-2">
                  {perms.map((p) => {
                    const currentVal = groupPermsConfig[p.code] || "none";
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border bg-muted/20 p-2.5 text-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-foreground">{p.code}</div>
                          <div className="text-muted-foreground">{p.description}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant={currentVal === "allow" ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              setGroupPermsConfig({
                                ...groupPermsConfig,
                                [p.code]: currentVal === "allow" ? "none" : "allow",
                              })
                            }
                          >
                            Autoriser
                          </Button>
                          <Button
                            type="button"
                            variant={currentVal === "deny" ? "destructive" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              setGroupPermsConfig({
                                ...groupPermsConfig,
                                [p.code]: currentVal === "deny" ? "none" : "deny",
                              })
                            }
                          >
                            Interdire
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupPermModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveGroupPerms} disabled={setGroupPermsMutation.isPending}>
              Enregistrer les règles du groupe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODALE : INSPECTEUR DE DROITS EFFECTIFS                             */}
      {/* =================================================================== */}
      <Dialog open={inspectUserModalOpen} onOpenChange={setInspectUserModalOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Permissions Effectives Réelles
            </DialogTitle>
            <DialogDescription>
              Calcul déterministe appliquant l'ordre des priorités de FormaCenter (Super Admin
              Override &gt; Explicit Deny &gt; Explicit Grant &gt; Default Deny).
            </DialogDescription>
          </DialogHeader>

          {loadingEffective || !effectivePerms ? (
            <div className="py-8 text-center text-muted-foreground">Calcul des droits réels…</div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3 text-xs">
                <div>
                  <span className="font-semibold text-foreground">Rôles actifs : </span>
                  {effectivePerms.roles.map((r) => (
                    <Badge key={r.code} variant="secondary" className="mr-1">
                      {r.nom}
                    </Badge>
                  ))}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Groupes d'appartenance : </span>
                  {effectivePerms.groups.length === 0 ? (
                    <span className="text-muted-foreground">Aucun</span>
                  ) : (
                    effectivePerms.groups.map((g) => (
                      <Badge key={g.id} variant="outline" className="mr-1">
                        {g.nom}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {effectivePerms.isSuperAdmin && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Cet utilisateur possède le rôle super_admin : toutes les permissions système sont
                  inconditionnellement accordées.
                </div>
              )}

              {/* Interdictions explicites */}
              {effectivePerms.deniedPermissions.length > 0 && (
                <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
                    <XCircle className="h-4 w-4" />
                    Interdictions Explicites (Explicit Deny) :
                  </div>
                  <div className="space-y-1">
                    {effectivePerms.deniedPermissions.map((code) => (
                      <div key={code} className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-destructive">{code}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {effectivePerms.provenance[code]?.deniedBy.join(", ") || "Groupe"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Permissions accordées */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Permissions Accordées ({effectivePerms.grantedPermissions.length})
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-lg border p-2 text-xs">
                  {effectivePerms.grantedPermissions.length === 0 ? (
                    <p className="p-4 text-center text-muted-foreground">
                      Aucune permission accordée. L'utilisateur est en refus par défaut.
                    </p>
                  ) : (
                    effectivePerms.grantedPermissions.map((code) => (
                      <div
                        key={code}
                        className="flex items-center justify-between rounded bg-muted/30 px-3 py-1.5"
                      >
                        <span className="font-mono font-bold text-foreground">{code}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {effectivePerms.provenance[code]?.grantedBy.join(", ") || "Héritée"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInspectUserModalOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODALE : AFFECTATION DE RÔLE À L'UTILISATEUR                        */}
      {/* =================================================================== */}
      <Dialog open={assignRoleModalOpen} onOpenChange={setAssignRoleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Affectation de Rôles : {selectedUserForAssign?.nom}</DialogTitle>
            <DialogDescription>
              Attribuez ou retirez un rôle pour cet utilisateur. Les droits sont effectifs
              immédiatement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rôles Disponibles
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {roles.map((r) => {
                const isAssigned = selectedUserForAssign?.roles.includes(r.code);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border p-2.5 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{r.nom}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{r.code}</div>
                    </div>
                    {isAssigned ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (selectedUserForAssign) {
                            revokeRoleMutation.mutate({
                              userId: selectedUserForAssign.id,
                              roleId: r.id,
                            });
                          }
                        }}
                        disabled={revokeRoleMutation.isPending}
                      >
                        Révoquer
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (selectedUserForAssign) {
                            assignRoleMutation.mutate({
                              userId: selectedUserForAssign.id,
                              roleId: r.id,
                            });
                          }
                        }}
                        disabled={assignRoleMutation.isPending}
                      >
                        Attribuer
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignRoleModalOpen(false)}>
              Terminer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
