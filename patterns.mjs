const node = (name, role, shape, x, y, hidden = false) => ({name, role, shape, x, y, hidden});
const step = (calls, title, text, reveal = [], roles = {}) => ({calls, title, text, reveal, roles});

export const patterns = [
  {
    id:'strategy', group:'Behavioral', name:'Strategy',
    intro:'Keep checkout unchanged while swapping the pricing algorithm.',
    use:'Use it when an operation needs interchangeable algorithms for pricing, sorting or routing.',
    cost:'Some part of the system still has to choose the strategy. A stable rule with two branches may only need a conditional.',
    nodes:{
      client:node('Order','Supplies the price', 'actor', .15,.48),
      context:node('Checkout','Uses RegularPrice', 'hub', .49,.48),
      regular:node('RegularPrice','No discount', 'block', .83,.24),
      member:node('MemberPrice','10% member discount', 'gem', .83,.73),
    },
    steps:[
      step([['client','context','total(100)'],['context','regular','apply(100)']], 'Start with regular pricing','Checkout delegates the calculation to its current strategy. RegularPrice returns 100.'),
      step([['client','context','setPricing(member)']], 'Swap the strategy','The same Checkout object now holds MemberPrice. Its public method stays the same.',[],{context:'Uses MemberPrice'}),
      step([['client','context','total(100)'],['context','member','apply(100)']], 'The same call takes a new route','Checkout calls apply(100) again. MemberPrice returns 90.'),
      step([['member','context','90'],['context','client','90']], 'Return the total','The caller gets the discounted amount without knowing the pricing formula.'),
    ],
    code:`interface Pricing { int apply(int amount); }
class Checkout {
    private Pricing pricing = amount -> amount;
    void setPricing(Pricing pricing) { this.pricing = pricing; }
    int total(int amount) { return pricing.apply(amount); }
}
// checkout.setPricing(amount -> amount * 9 / 10);`,
  },
  {
    id:'observer', group:'Behavioral', name:'Observer',
    intro:'Notify interested objects when something changes.',
    use:'Use it for UI events or domain events when publishers should stay independent of their subscribers.',
    cost:'Slow synchronous callbacks delay later subscribers. Define callback order, error handling and when to unsubscribe.',
    nodes:{
      order:node('Order','Payment confirmed','actor',.15,.5),
      publisher:node('PaidEvents','Tracks subscribers','hub',.48,.5),
      email:node('Email','Sends a receipt','block',.82,.18),
      inventory:node('Inventory','Confirms stock','gem',.82,.50),
      metrics:node('Metrics','Updates counters','ring',.82,.82),
    },
    steps:[
      step([['email','publisher','subscribe()'],['inventory','publisher','subscribe()'],['metrics','publisher','subscribe()']], 'Register subscribers','The publisher stores three callbacks. Each subscriber owns its own behavior.',[],{publisher:'3 subscribers'}),
      step([['order','publisher','publish(Paid)']], 'Publish a paid event','The order publishes an event. The publisher handles delivery to email, inventory and metrics.'),
      step([['publisher','email','onPaid()'],['publisher','inventory','onPaid()'],['publisher','metrics','onPaid()']], 'Notify each subscriber','The callbacks run one at a time here. Asynchronous delivery requires its own failure and delivery rules.'),
      step([['metrics','publisher','unsubscribe()'],['order','publisher','publish(Paid)'],['publisher','email','onPaid()'],['publisher','inventory','onPaid()']], 'Unsubscribe before the next event','Metrics unsubscribes. The next event only goes to email and inventory.',[],{publisher:'2 subscribers',metrics:'Unsubscribed'}),
    ],
    code:`class PaidEvents {
    private final List<Consumer<Order>> listeners = new ArrayList<>();
    void subscribe(Consumer<Order> listener) { listeners.add(listener); }
    void unsubscribe(Consumer<Order> listener) { listeners.remove(listener); }
    void publish(Order order) {
        for (var listener : List.copyOf(listeners)) listener.accept(order);
    }
}`,
  },
  {
    id:'state', group:'Behavioral', name:'State',
    intro:'The current order state determines what the same pay() call does.',
    use:'Use it when an object has a lifecycle and the allowed operations differ substantially from one state to another.',
    cost:'An enum or transition table may be enough for a few states. Handle concurrent updates independently.',
    nodes:{
      client:node('Caller','Calls pay()','actor',.15,.49),
      order:node('Order','State: pending','hub',.49,.49),
      pending:node('Pending','Allows payment','block',.83,.23),
      paid:node('Paid','Rejects duplicate payment','gem',.83,.73,true),
    },
    steps:[
      step([['client','order','pay()'],['order','pending','pay(order)']], 'A pending order accepts payment','Order delegates pay() to Pending. The state object decides whether to accept payment.'),
      step([['pending','paid','transition → Paid']], 'Payment moves the order to Paid','After confirmation, Pending replaces the state object with Paid. Paid handles later requests.',['paid'],{order:'State: paid'}),
      step([['client','order','pay()'],['order','paid','pay(order)'],['paid','order','ALREADY_PAID'],['order','client','ALREADY_PAID']], 'The same method behaves differently','Paid returns ALREADY_PAID. A production system also needs durable state and idempotent charging.'),
    ],
    code:`interface OrderState { String pay(Order order); }
class Pending implements OrderState {
    public String pay(Order order) {
        order.setState(new Paid()); // Payment confirmation omitted for brevity
        return "PAID";
    }
}
class Paid implements OrderState {
    public String pay(Order order) { return "ALREADY_PAID"; }
}`,
  },
  {
    id:'chain', group:'Behavioral', name:'Chain of Responsibility',
    intro:'Pass a request through handlers that can stop it or forward it.',
    use:'Use it for authorization, middleware or approval flows with reorderable checks.',
    cost:'Handler order affects results. Make it clear which handler stopped a request and what happens at the end of the chain.',
    nodes:{
      caller:node('Request','Submits an order','actor',.12,.33),
      auth:node('Auth','Checks login','ring',.38,.49),
      validate:node('Validate','Checks stock','ring',.64,.33),
      service:node('OrderService','Places the order','gem',.87,.69),
    },
    steps:[
      step([['caller','auth','request']], 'An unauthenticated request reaches Auth','Auth sees that the caller is unauthenticated and returns 401 before validation runs.'),
      step([['auth','caller','401']], 'Stop at Auth','The response goes back to the caller. Later handlers never receive this request.'),
      step([['caller','auth','retry()'],['auth','validate','next(request)'],['validate','service','next(request)']], 'A valid request traverses the chain','Auth and Validate forward the request. OrderService receives it after both checks pass.'),
    ],
    code:`Handler chain = auth.andThen(validate).andThen(orderService);
Response handle(Request request, Handler next) {
    if (!request.authenticated()) return Response.unauthorized();
    return next.handle(request);
}`,
  },
  {
    id:'factory', group:'Creational', name:'Factory Method',
    intro:'Let a subclass choose what to create while sharing the workflow in the base class.',
    use:'Use it when one workflow needs different product implementations, such as writers for different report formats.',
    cost:'Each product may require a creator subclass. A simple factory can be enough when an enum drives the choice.',
    nodes:{
      caller:node('Report job','Calls export()','actor',.15,.49),
      exporter:node('Exporter','Shared export flow','hub',.48,.49),
      pdf:node('PdfExporter','Overrides the factory','block',.79,.22),
      writer:node('PdfWriter','implements Writer','gem',.79,.73,true),
    },
    steps:[
      step([['caller','exporter','export(report)']], 'Run the inherited workflow','The job uses PdfExporter. The shared export() method lives in the Exporter base class.'),
      step([['exporter','pdf','createWriter()']], 'Dispatch to the subclass factory','The createWriter() call resolves to the PdfExporter implementation.'),
      step([['pdf','writer','new PdfWriter()']], 'Create the concrete product','PdfExporter creates a PdfWriter. The shared workflow only depends on the Writer interface.',['writer']),
      step([['exporter','writer','write(report)']], 'Write through the shared interface','CSV export can supply its own Exporter subclass and Writer implementation.'),
    ],
    code:`abstract class Exporter {
    protected abstract Writer createWriter();
    final void export(Report report) { createWriter().write(report); }
}
class PdfExporter extends Exporter {
    protected Writer createWriter() { return new PdfWriter(); }
}`,
  },
  {
    id:'builder', group:'Creational', name:'Builder',
    intro:'Collect construction options in steps and build the result once.',
    use:'Use it when an object has several optional parameters or needs to validate combinations before construction.',
    cost:'A constructor is simpler for a few parameters. Keep the mutable builder local to its caller.',
    nodes:{
      caller:node('Caller','Configures a job','actor',.16,.5),
      builder:node('ExportBuilder','Collects options','stack',.50,.5),
      result:node('ExportJob','Immutable result','gem',.83,.5,true),
    },
    steps:[
      step([['caller','builder','format(PDF)']], 'Set the output format','The builder stores the format. There is no ExportJob yet.',[],{builder:'Format: PDF'}),
      step([['caller','builder','file("sales.pdf")']], 'Set the output file','The named method makes the option clear. Unspecified options keep their defaults.',[],{builder:'PDF / sales.pdf'}),
      step([['builder','result','build()']], 'Validate and build the result','build() checks required options and creates an immutable ExportJob. The result is separate from the builder.',['result']),
    ],
    code:`ExportJob job = ExportJob.builder()
    .format(Format.PDF)
    .file("sales.pdf")
    .build(); // Validate the required options and their combination`,
  },
  {
    id:'singleton', group:'Creational', name:'Singleton',
    intro:'Give multiple callers a reference to the same instance.',
    use:'Use it when callers genuinely need one shared resource with a defined lifetime, such as an immutable configuration.',
    cost:'Global access can hide dependencies. A Java enum singleton is scoped to its class loader. Separate processes have separate instances.',
    nodes:{
      a:node('Service A','First access','actor',.17,.25),
      b:node('Service B','Second access','actor',.17,.73),
      entry:node('AppConfig','Shared access point','hub',.50,.50),
      value:node('INSTANCE','The shared object','gem',.83,.50,true),
    },
    steps:[
      step([['a','entry','AppConfig.INSTANCE'],['entry','value','Class initialization']], 'Initialize the class on first access','Class initialization creates the enum constant. The diagram tracks its identity as #1.',['value']),
      step([['value','a','Reference #1']], 'Service A gets instance #1','The caller receives a reference to the shared object.'),
      step([['b','entry','AppConfig.INSTANCE'],['value','b','Reference #1']], 'Service B also gets instance #1','Both callers receive the same enum constant. Mutable fields still need their own thread-safety guarantees.'),
    ],
    code:`enum AppConfig {
    INSTANCE;
}
var a = AppConfig.INSTANCE;
var b = AppConfig.INSTANCE;
assert a == b;`,
  },
  {
    id:'adapter', group:'Structural', name:'Adapter',
    intro:'Connect a payment provider with a different request and response format to a shared interface.',
    use:'Use it when an existing component can do the work, but its interface differs from the one your application expects.',
    cost:'Specify how to map amounts, events and errors. Expose provider-specific capabilities explicitly when needed.',
    nodes:{
      app:node('Billing','Uses PaymentPort','actor',.15,.5),
      adapter:node('PayPalAdapter','Maps requests and results','ring',.49,.5),
      psp:node('PayPal SDK','Expects provider fields','stack',.83,.5),
    },
    steps:[
      step([['app','adapter','createCheckout(order)']], 'Call the shared interface','Billing creates its own CheckoutRequest and calls PaymentPort.'),
      step([['adapter','psp','createOrder(payload)']], 'Translate to a provider request','The adapter maps the amount, currency and order ID into the shape expected by the provider.'),
      step([['psp','adapter','providerResponse'],['adapter','app','CheckoutResult']], 'Translate back to a shared result','The adapter extracts the provider order ID and approval URL. Billing continues with its own result type.'),
    ],
    code:`class PayPalAdapter implements PaymentPort {
    private final PayPalClient client;
    PayPalAdapter(PayPalClient client) { this.client = client; }
    public CheckoutResult createCheckout(CheckoutRequest req) {
        var result = client.createOrder(toProviderPayload(req));
        return new CheckoutResult(result.id(), result.approvalUrl());
    }
}`,
  },
  {
    id:'decorator', group:'Structural', name:'Decorator',
    intro:'Wrap an object with the same interface and add one behavior per layer.',
    use:'Use it to combine logging, timing or compression independently while callers keep the same interface.',
    cost:'Wrapper order can change results and measurements. More layers make call stacks longer.',
    nodes:{
      client:node('Caller','Calls read()','actor',.13,.39),
      metrics:node('TimedReader','Outer: timing','ring',.38,.58),
      logs:node('LoggedReader','Inner: logging','ring',.63,.39),
      file:node('FileReader','Reads the data','stack',.86,.58),
    },
    steps:[
      step([['client','metrics','read()']], 'Enter the outer wrapper','TimedReader and FileReader both implement Reader. TimedReader records the start time.'),
      step([['metrics','logs','delegate.read()'],['logs','file','delegate.read()']], 'Delegate through the wrappers','LoggedReader logs the call and forwards it to the object that reads the file.'),
      step([['file','logs','bytes'],['logs','metrics','bytes'],['metrics','client','bytes']], 'Apply behavior on the way back','The logging layer records the result. The timing layer measures elapsed time. The caller receives the bytes.'),
    ],
    code:`Reader reader = new TimedReader(
    new LoggedReader(new FileReader()));
byte[] bytes = reader.read();`,
  },
  {
    id:'facade', group:'Structural', name:'Facade',
    intro:'Give callers one entry point for a workflow that spans several subsystems.',
    use:'Use it when callers repeatedly coordinate the same subsystems, such as during order placement.',
    cost:'Keep the interface focused on one use case. The workflow still needs explicit failure and compensation rules.',
    nodes:{
      client:node('Client','Submits an order','actor',.15,.50),
      facade:node('OrderFacade','Coordinates the workflow','hub',.49,.50),
      stock:node('Inventory','Reserves items','stack',.82,.18),
      payment:node('Payment','Confirms payment','gem',.82,.50),
      notify:node('Notification','Sends confirmation','block',.82,.82),
    },
    steps:[
      step([['client','facade','placeOrder(order)']], 'Enter through one method','The client places an order. The facade decides which services to call and in what order.'),
      step([['facade','stock','reserve(order)']], 'Reserve stock first','The workflow advances after inventory has been reserved.'),
      step([['facade','payment','charge(order)']], 'Confirm payment next','This step follows the success path. If payment fails, the workflow must release inventory or trigger compensation.'),
      step([['facade','notify','confirm(order)'],['facade','client','receipt']], 'Confirm the order and return a receipt','One client call coordinates inventory, payment and notification.'),
    ],
    code:`Receipt placeOrder(Order order) {
    stock.reserve(order);
    // Success path only
    Receipt receipt = payment.charge(order);
    notification.confirm(order);
    return receipt;
}`,
  },
  {
    id:'proxy', group:'Structural', name:'Proxy',
    intro:'Put a stand-in behind the same interface to control access to the real object.',
    use:'Use it for access checks, lazy initialization, caching or remote access behind a stable interface.',
    cost:'The proxy adds a decision point. Keep failure behavior explicit and check access at the actual trust boundary.',
    nodes:{
      client:node('Client','Calls ReportReader','actor',.15,.5),
      proxy:node('AccessProxy','Checks permission','ring',.5,.5),
      target:node('ReportStore','Reads the report','stack',.83,.5),
    },
    steps:[
      step([['client','proxy','read(reportId)']], 'Call the stand-in', 'The client calls ReportReader. The instance it holds is an access proxy.',[],{proxy:'Checking access'}),
      step([['proxy','client','AccessDenied']], 'Deny access before touching the target', 'The proxy rejects the request. ReportStore never receives this call.',[],{proxy:'Denied',target:'Not called'}),
      step([['client','proxy','read(reportId)'],['proxy','target','read(reportId)']], 'Forward the authorized request', 'An authorized caller uses the same method. The proxy forwards it to ReportStore.',[],{proxy:'Allowed',target:'Loads the report'}),
      step([['target','proxy','report'],['proxy','client','report']], 'Return the result through the proxy', 'The client receives a report through the same interface. The proxy controls access without translating the API.'),
    ],
    code:`interface ReportReader { Report read(String id); }
record AccessProxy(ReportReader target, Access access)
        implements ReportReader {
    public Report read(String id) {
        access.requireRead(id);
        return target.read(id);
    }
}`,
  },
  {
    id:'composite', group:'Structural', name:'Composite',
    intro:'Give individual objects and groups the same interface, then let groups delegate to their children.',
    use:'Use it for tree structures such as folders, UI components or product bundles when the same operation applies to a leaf and a group.',
    cost:'The common interface should only expose operations that make sense on both leaves and groups. Keep the tree acyclic.',
    nodes:{
      client:node('Caller','Calls size()','actor',.12,.49),
      root:node('Reports','Root folder','hub',.38,.49),
      file:node('summary.txt','Leaf: 4 KB','gem',.64,.23),
      nested:node('Archive','Child folder','hub',.65,.76),
      nestedFile:node('detail.txt','Leaf: 6 KB','gem',.88,.60),
    },
    steps:[
      step([['client','root','size()']], 'Use the same interface on a folder', 'Files and folders both implement Entry. The caller asks the root Entry for its size.'),
      step([['root','file','size()'],['file','root','4 KB']], 'A leaf returns its own size', 'The root folder asks summary.txt for its size. The file returns 4 KB directly.',[],{root:'Subtotal: 4 KB'}),
      step([['root','nested','size()'],['nested','nestedFile','size()'],['nestedFile','nested','6 KB']], 'A child folder calls its own child', 'Archive implements the same size() method. It delegates to detail.txt and gets 6 KB back.',[],{nested:'Subtotal: 6 KB'}),
      step([['nested','root','6 KB'],['root','client','10 KB']], 'Aggregate on the way back', 'The root adds its two child results and returns 10 KB. Each folder only knows its immediate children.',[],{root:'Total: 10 KB'}),
    ],
    code:`interface Entry { long size(); }
record Document(long bytes) implements Entry {
    public long size() { return bytes; }
}
record Folder(List<Entry> children) implements Entry {
    public long size() {
        return children.stream().mapToLong(Entry::size).sum();
    }
}
// 4 KB + folder containing 6 KB = 10 KB`,
  },
];
