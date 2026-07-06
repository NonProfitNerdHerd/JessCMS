-- Phase 6: public frontend support

INSERT OR IGNORE INTO theme_settings (key, value) VALUES
  ('theme_name', '"Jess Default"'),
  ('border_radius', '"0.375rem"');

INSERT OR IGNORE INTO menus (id, slug, name, location) VALUES
  ('menu_primary', 'primary', 'Primary Menu', 'primary'),
  ('menu_footer', 'footer', 'Footer Menu', 'footer');

INSERT OR IGNORE INTO menu_items (id, menu_id, parent_id, label, url, content_type, content_id, sort_order, open_in_new_tab) VALUES
  ('mi_home', 'menu_primary', NULL, 'Home', '/', NULL, NULL, 0, 0),
  ('mi_blog', 'menu_primary', NULL, 'Blog', '/blog', NULL, NULL, 10, 0),
  ('mi_events', 'menu_primary', NULL, 'Events', '/events', NULL, NULL, 20, 0),
  ('mi_home_f', 'menu_footer', NULL, 'Home', '/', NULL, NULL, 0, 0),
  ('mi_blog_f', 'menu_footer', NULL, 'Blog', '/blog', NULL, NULL, 10, 0);
