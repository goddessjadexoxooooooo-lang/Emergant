import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, DollarSign, Repeat, Heart, Crown } from "lucide-react";
import api from "@/lib/api";
import { Navbar } from "@/components/Brand";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function StatCard({ icon: Icon, label, value, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-3xl bg-card p-6 shadow-jade">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 font-display text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [tributes, setTributes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/members"),
      api.get("/admin/tributes"),
    ]).then(([s, m, t]) => {
      setStats(s.data);
      setMembers(m.data.members);
      setTributes(t.data.tributes);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#4A0E1B] text-white">
            <Crown className="h-5 w-5" />
          </span>
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The royal court</span>
            <h1 className="font-display text-4xl font-bold">Admin dashboard</h1>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-testid="admin-stats">
              <StatCard icon={Users} label="Members" value={stats.total_members} delay={0} />
              <StatCard icon={DollarSign} label="Total revenue" value={`$${stats.total_revenue.toFixed(2)}`} delay={0.05} />
              <StatCard icon={Repeat} label="Active subscriptions" value={stats.active_subscriptions} delay={0.1} />
              <StatCard icon={Heart} label="One-time tributes" value={stats.one_time_tributes} delay={0.15} />
            </div>

            <div className="mt-8 rounded-3xl bg-card p-6 sm:p-7 shadow-jade">
              <Tabs defaultValue="members">
                <TabsList className="rounded-full bg-accent p-1">
                  <TabsTrigger value="members" data-testid="admin-tab-members" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow">
                    Members ({members.length})
                  </TabsTrigger>
                  <TabsTrigger value="tributes" data-testid="admin-tab-tributes" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow">
                    Tributes ({tributes.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="members" className="mt-5">
                  <div className="overflow-x-auto">
                    <Table data-testid="admin-members-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total given</TableHead>
                          <TableHead className="text-right">Tributes</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((m) => (
                          <TableRow key={m.id} data-testid={`member-row-${m.id}`}>
                            <TableCell>
                              <div className="font-medium">{m.name}</div>
                              <div className="text-sm text-muted-foreground">{m.email}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`rounded-full capitalize ${m.role === "admin" ? "bg-[#4A0E1B] text-white" : ""}`}>{m.role}</Badge>
                            </TableCell>
                            <TableCell>
                              {m.is_active_member
                                ? <Badge className="rounded-full bg-primary/10 text-primary">Active</Badge>
                                : <span className="text-sm text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-semibold">${(m.total_contributed || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right">{m.tribute_count || 0}</TableCell>
                            <TableCell className="text-muted-foreground">{fmtDate(m.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="tributes" className="mt-5">
                  <div className="overflow-x-auto">
                    <Table data-testid="admin-tributes-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patron</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Rhythm</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tributes.map((t) => (
                          <TableRow key={t.id} data-testid={`tribute-admin-row-${t.id}`}>
                            <TableCell>
                              <div className="font-medium">{t.user_name}</div>
                              <div className="text-sm text-muted-foreground">{t.user_email}</div>
                            </TableCell>
                            <TableCell className="capitalize">{t.type}</TableCell>
                            <TableCell className="capitalize">{t.frequency || "—"}</TableCell>
                            <TableCell className="text-right font-semibold">${t.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`rounded-full capitalize ${t.status === "active" || t.status === "completed" ? "bg-primary/10 text-primary" : ""}`}>{t.status}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{fmtDate(t.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
