
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','staff');
CREATE TYPE public.table_status AS ENUM ('available','occupied','bill_requested','cleaning','ready');
CREATE TYPE public.order_status AS ENUM ('placed','accepted','preparing','ready','served','cancelled');
CREATE TYPE public.session_status AS ENUM ('active','paid','closed');
CREATE TYPE public.request_status AS ENUM ('pending','accepted','completed');

-- UPDATED AT
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'Staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'staff',
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

-- Every new signed-up user becomes staff (single staff dashboard app)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO anon, authenticated USING (true);

-- MENU ITEMS
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  is_veg BOOLEAN NOT NULL DEFAULT true,
  spice_level SMALLINT NOT NULL DEFAULT 0 CHECK (spice_level BETWEEN 0 AND 3),
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_chef_special BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu public read" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);

-- RESTAURANT TABLES
CREATE TABLE public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INT NOT NULL UNIQUE,
  seats INT NOT NULL DEFAULT 4,
  status public.table_status NOT NULL DEFAULT 'available',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurant_tables TO anon;
GRANT SELECT, UPDATE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tables public read" ON public.restaurant_tables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff update tables" ON public.restaurant_tables FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_tables_updated BEFORE UPDATE ON public.restaurant_tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SESSIONS
CREATE TABLE public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  status public.session_status NOT NULL DEFAULT 'active',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX one_active_session_per_table ON public.table_sessions (table_id) WHERE status = 'active';
GRANT SELECT, INSERT ON public.table_sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.table_sessions TO authenticated;
GRANT ALL ON public.table_sessions TO service_role;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions public read" ON public.table_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sessions guest insert" ON public.table_sessions FOR INSERT TO anon, authenticated WITH CHECK (status = 'active');
CREATE POLICY "sessions staff update" ON public.table_sessions FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ORDERS
CREATE SEQUENCE public.order_number_seq START 1;
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number INT NOT NULL DEFAULT nextval('public.order_number_seq'),
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  status public.order_status NOT NULL DEFAULT 'placed',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT USAGE ON SEQUENCE public.order_number_seq TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders public read" ON public.orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "orders guest insert" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (status = 'placed');
CREATE POLICY "orders staff update" ON public.orders FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0 AND quantity <= 50),
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO anon;
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order items public read" ON public.order_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "order items guest insert" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);

-- WAITER + BILL REQUESTS
CREATE TABLE public.waiter_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  status public.request_status NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.waiter_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.waiter_requests TO authenticated;
GRANT ALL ON public.waiter_requests TO service_role;
ALTER TABLE public.waiter_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waiter public read" ON public.waiter_requests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "waiter guest insert" ON public.waiter_requests FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');
CREATE POLICY "waiter staff update" ON public.waiter_requests FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_waiter_updated BEFORE UPDATE ON public.waiter_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.bill_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.bill_requests TO authenticated;
GRANT ALL ON public.bill_requests TO service_role;
ALTER TABLE public.bill_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill public read" ON public.bill_requests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bill guest insert" ON public.bill_requests FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');
CREATE POLICY "bill staff update" ON public.bill_requests FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_bill_updated BEFORE UPDATE ON public.bill_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ACTIVITY LOG
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES auth.users ON DELETE SET NULL,
  staff_name TEXT NOT NULL DEFAULT 'Staff',
  action TEXT NOT NULL,
  table_number INT,
  order_number INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs staff read" ON public.activity_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "logs staff insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = staff_id);

-- REALTIME
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.restaurant_tables REPLICA IDENTITY FULL;
ALTER TABLE public.waiter_requests REPLICA IDENTITY FULL;
ALTER TABLE public.bill_requests REPLICA IDENTITY FULL;
ALTER TABLE public.table_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;

-- SEED TABLES
INSERT INTO public.restaurant_tables (table_number, seats) SELECT g, CASE WHEN g % 3 = 0 THEN 6 ELSE 4 END FROM generate_series(1,12) g;

-- SEED CATEGORIES
INSERT INTO public.categories (name, slug, sort_order) VALUES
('Starters','starters',1),('Soups','soups',2),('Main Course','main-course',3),('Rice','rice',4),
('Breads','breads',5),('Chinese','chinese',6),('Desserts','desserts',7),('Ice Cream','ice-cream',8),
('Beverages','beverages',9),('Combos','combos',10),('Kids Menu','kids-menu',11);

-- SEED MENU ITEMS
INSERT INTO public.menu_items (category_id, name, description, price, image_url, is_veg, spice_level, is_available, is_popular, is_chef_special, sort_order)
SELECT c.id, v.name, v.description, v.price, v.image_url, v.is_veg, v.spice, v.avail, v.pop, v.chef, v.sort
FROM (VALUES
('starters','Paneer Tikka','Char-grilled cottage cheese marinated in yoghurt and spices',320,'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800&q=70',true,2,true,true,false,1),
('starters','Chicken 65','Fiery South Indian fried chicken with curry leaves',360,'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=70',false,3,true,true,false,2),
('starters','Crispy Corn','Golden fried sweet corn tossed with pepper and herbs',260,'https://images.unsplash.com/photo-1600289031464-74d374b64991?w=800&q=70',true,1,true,false,false,3),
('starters','Tandoori Prawns','Jumbo prawns smoked in the clay oven',540,'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=800&q=70',false,2,true,false,true,4),
('soups','Sweet Corn Soup','Silky broth with sweet corn and vegetables',180,'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=70',true,0,true,false,false,1),
('soups','Hot & Sour Soup','Peppery broth with shredded vegetables',190,'https://images.unsplash.com/photo-1604909052743-94e838986d24?w=800&q=70',true,2,true,true,false,2),
('soups','Chicken Clear Soup','Light chicken consommé with spring onion',210,'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=800&q=70',false,0,true,false,false,3),
('soups','Tomato Shorba','Roasted tomato and basil shorba',170,'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=70',true,1,true,false,false,4),
('main-course','Paneer Butter Masala','Cottage cheese in a velvety tomato and cashew gravy',380,'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=70',true,1,true,true,true,1),
('main-course','Butter Chicken','Tandoori chicken simmered in creamy makhani gravy',450,'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=70',false,2,true,true,true,2),
('main-course','Dal Makhani','Black lentils slow cooked overnight with butter',300,'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=70',true,1,true,true,false,3),
('main-course','Mutton Rogan Josh','Kashmiri lamb curry with aromatic spices',560,'https://images.unsplash.com/photo-1545247181-516773cae754?w=800&q=70',false,3,true,false,true,4),
('main-course','Kadai Vegetable','Seasonal vegetables tossed in kadai masala',320,'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=70',true,2,true,false,false,5),
('main-course','Fish Curry','Coastal fish curry with coconut and tamarind',480,'https://images.unsplash.com/photo-1626500155537-4b0ecc0cf19d?w=800&q=70',false,3,false,false,false,6),
('rice','Chicken Biryani','Dum-cooked long grain rice layered with spiced chicken',420,'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=70',false,3,true,true,true,1),
('rice','Vegetable Biryani','Fragrant basmati with garden vegetables and saffron',340,'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=70',true,2,true,true,false,2),
('rice','Jeera Rice','Basmati tempered with roasted cumin',190,'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=70',true,0,true,false,false,3),
('rice','Curd Rice','Comforting South Indian tempered curd rice',180,'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&q=70',true,0,true,false,false,4),
('breads','Butter Naan','Tandoor baked leavened bread brushed with butter',70,'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=800&q=70',true,0,true,true,false,1),
('breads','Garlic Naan','Naan topped with garlic and coriander',90,'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=800&q=70',true,1,true,true,false,2),
('breads','Tandoori Roti','Whole wheat roti from the clay oven',50,'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=70',true,0,true,false,false,3),
('breads','Laccha Paratha','Flaky multi-layered paratha',80,'https://images.unsplash.com/photo-1619221882220-947b3d3c8861?w=800&q=70',true,0,true,false,false,4),
('chinese','Veg Hakka Noodles','Wok tossed noodles with julienned vegetables',280,'https://images.unsplash.com/photo-1552611052-33e04de081de?w=800&q=70',true,1,true,true,false,1),
('chinese','Chilli Chicken','Crispy chicken tossed in a spicy soy chilli glaze',360,'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800&q=70',false,3,true,true,false,2),
('chinese','Veg Manchurian','Vegetable dumplings in tangy Manchurian sauce',300,'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=70',true,2,true,false,false,3),
('chinese','Schezwan Fried Rice','Fiery Schezwan rice with crunchy vegetables',290,'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=70',true,3,true,false,false,4),
('desserts','Gulab Jamun','Warm milk dumplings soaked in cardamom syrup',150,'https://images.unsplash.com/photo-1601303516534-bf0b1eb70e18?w=800&q=70',true,0,true,true,false,1),
('desserts','Gajar Ka Halwa','Slow cooked carrot pudding with ghee and nuts',180,'https://images.unsplash.com/photo-1666190092159-3171cf0fbb12?w=800&q=70',true,0,true,false,true,2),
('desserts','Chocolate Lava Cake','Molten centre chocolate cake',240,'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=800&q=70',true,0,true,true,false,3),
('desserts','Rasmalai','Saffron milk soaked cottage cheese discs',170,'https://images.unsplash.com/photo-1605197161470-5d2a9af0ac7e?w=800&q=70',true,0,true,false,false,4),
('ice-cream','Vanilla Bean Scoop','Madagascar vanilla, two scoops',120,'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800&q=70',true,0,true,false,false,1),
('ice-cream','Belgian Chocolate Scoop','Rich dark chocolate gelato',140,'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=70',true,0,true,true,false,2),
('ice-cream','Sizzling Brownie','Warm brownie, vanilla ice cream, hot chocolate',280,'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=70',true,0,true,true,true,3),
('beverages','Masala Chai','Spiced Indian tea brewed to order',90,'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&q=70',true,1,true,false,false,1),
('beverages','Fresh Lime Soda','Sweet or salted, served chilled',110,'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&q=70',true,0,true,false,false,2),
('beverages','Mango Lassi','Thick yoghurt smoothie with alphonso mango',160,'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=800&q=70',true,0,true,true,false,3),
('beverages','Cold Coffee','Blended coffee with vanilla ice cream',180,'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=70',true,0,true,false,false,4),
('combos','Veg Thali','Dal, paneer, rice, breads, salad and dessert',450,'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=70',true,1,true,true,true,1),
('combos','Non-Veg Thali','Chicken curry, kebab, rice, breads and dessert',550,'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800&q=70',false,2,true,true,false,2),
('kids-menu','Cheesy Pasta','Creamy white sauce penne, mildly seasoned',240,'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=70',true,0,true,false,false,1),
('kids-menu','Mini Chicken Nuggets','Crispy nuggets with ketchup and fries',260,'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=70',false,0,true,true,false,2)
) AS v(cat,name,description,price,image_url,is_veg,spice,avail,pop,chef,sort)
JOIN public.categories c ON c.slug = v.cat;
