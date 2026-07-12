# Airlink v3.0 — FreeRADIUS with our SQL/site/client config baked in.
# Baking (rather than bind-mounting) avoids the Windows world-writable-config
# problem: FreeRADIUS refuses to start on globally-writable config files.
FROM freeradius/freeradius-server:3.2.10

COPY mods-enabled/sql /etc/freeradius/mods-enabled/sql
COPY sites-enabled/default /etc/freeradius/sites-enabled/default
COPY clients.conf /etc/freeradius/clients.conf

RUN chown -R freerad:freerad /etc/freeradius \
    && chmod -R o-w /etc/freeradius
