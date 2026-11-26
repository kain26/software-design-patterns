const node = (name, role, shape, x, y, hidden = false) => ({name, role, shape, x, y, hidden});
const step = (calls, title, text, reveal = [], roles = {}) => ({calls, title, text, reveal, roles});

export const patterns = [
  {
    id:'strategy', group:'行为型', name:'Strategy', zh:'策略模式',
    intro:'让结账流程保持原样，把折扣算法换成可插拔的对象。',
    use:'同一个操作有多种算法，调用方想在运行时切换，例如定价、排序或路由。',
    cost:'调用方仍需决定选哪一种。规则很少且稳定时，简单条件分支就够了。',
    nodes:{
      client:node('订单','提交价格', 'actor', .15,.48),
      context:node('Checkout','当前策略：原价', 'hub', .49,.48),
      regular:node('RegularPrice','原价策略', 'block', .83,.24),
      member:node('MemberPrice','会员九折', 'gem', .83,.73),
    },
    steps:[
      step([['client','context','total(100)'],['context','regular','apply(100)']], '先使用原价策略','结账对象把价格计算交给当前策略。普通策略返回 100。'),
      step([['client','context','setPricing(member)']], '替换策略对象','Checkout 的入口没有变化。同一个结账对象现在持有 MemberPrice。',[],{context:'当前策略：会员九折'}),
      step([['client','context','total(100)'],['context','member','apply(100)']], '同一调用走向另一条路径','结账还是调用 apply(100)。会员策略返回 90。'),
      step([['member','context','90'],['context','client','90']], '把结果返回给调用方','调用方得到折扣后的价格。订单流程无需知道算法细节。'),
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
    id:'observer', group:'行为型', name:'Observer', zh:'观察者模式',
    intro:'一次状态变化，通知所有已订阅的对象。',
    use:'发布者应与具体订阅者解耦，例如界面事件和领域事件。',
    cost:'同步回调会彼此影响。需要提前约定执行顺序、异常处理及退订生命周期。',
    nodes:{
      order:node('订单','支付完成','actor',.15,.5),
      publisher:node('PaidEvents','订阅者列表','hub',.48,.5),
      email:node('邮件服务','发送收据','block',.82,.18),
      inventory:node('库存服务','确认库存','gem',.82,.50),
      metrics:node('统计服务','更新指标','ring',.82,.82),
    },
    steps:[
      step([['email','publisher','subscribe()'],['inventory','publisher','subscribe()'],['metrics','publisher','subscribe()']], '登记订阅者','发布者保存三个回调引用，订阅者各自携带业务逻辑。',[],{publisher:'3 个订阅者'}),
      step([['order','publisher','publish(Paid)']], '订单发布已支付事件','订单只发布事件，不需要逐个调用邮件、库存和统计。'),
      step([['publisher','email','onPaid()'],['publisher','inventory','onPaid()'],['publisher','metrics','onPaid()']], '同一个事件分发给三个订阅者','动画依次展示同步回调。分发策略也可以异步，但要自行处理失败与交付语义。'),
      step([['metrics','publisher','unsubscribe()'],['order','publisher','publish(Paid)'],['publisher','email','onPaid()'],['publisher','inventory','onPaid()']], '退订影响下一次分发','统计服务退出订阅后，下一次发布只通知剩余两个订阅者。',[],{publisher:'2 个订阅者',metrics:'已退订'}),
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
    id:'state', group:'行为型', name:'State', zh:'状态模式',
    intro:'同一个 pay() 调用，由订单当前状态决定如何处理。',
    use:'对象有明确生命周期，各状态下允许的操作和行为差异较大。',
    cost:'少量状态与规则可用枚举或转换表。还需单独保证并发写入的一致性。',
    nodes:{
      client:node('调用方','发起 pay()','actor',.15,.49),
      order:node('Order','当前状态：待支付','hub',.49,.49),
      pending:node('Pending','允许付款','block',.83,.23),
      paid:node('Paid','重复请求返回已支付','gem',.83,.73,true),
    },
    steps:[
      step([['client','order','pay()'],['order','pending','pay(order)']], '待支付订单接收付款','订单把调用委托给 Pending，由当前状态判断是否接受。'),
      step([['pending','paid','transition → Paid']], '支付成功，状态迁移','Pending 在确认成功后替换订单的状态对象。Paid 开始负责后续请求。',['paid'],{order:'当前状态：已支付'}),
      step([['client','order','pay()'],['order','paid','pay(order)'],['paid','order','ALREADY_PAID'],['order','client','ALREADY_PAID']], '同一方法表现不同','新状态识别订单已支付，返回 ALREADY_PAID。生产系统还需要持久化状态和扣款幂等。'),
    ],
    code:`interface OrderState { String pay(Order order); }
class Pending implements OrderState {
    public String pay(Order order) {
        order.setState(new Paid()); // 示例省略扣款确认
        return "PAID";
    }
}
class Paid implements OrderState {
    public String pay(Order order) { return "ALREADY_PAID"; }
}`,
  },
  {
    id:'chain', group:'行为型', name:'Chain of Responsibility', zh:'责任链模式',
    intro:'请求沿处理器链传递，每一站决定拦截还是继续。',
    use:'权限检查、中间件和分级审批，需要可重排的处理顺序。',
    cost:'顺序会改变结果。要能看出哪一站拦截以及没有任何处理器接管时的行为。',
    nodes:{
      caller:node('请求','提交订单','actor',.12,.33),
      auth:node('Auth','登录检查','ring',.38,.33),
      validate:node('Validate','库存校验','ring',.64,.33),
      service:node('OrderService','执行业务','gem',.87,.69),
    },
    steps:[
      step([['caller','auth','request']], '未登录的请求抵达第一站','Auth 判定未登录，直接返回 401，后续校验不执行。'),
      step([['auth','caller','401']], '在 Auth 短路','请求方向折返。后续节点没有收到此次调用。'),
      step([['caller','auth','retry()'],['auth','validate','next(request)'],['validate','service','next(request)']], '有效请求通过整条链','登录检查与库存检查都放行，最后抵达订单服务。'),
    ],
    code:`Handler chain = auth.andThen(validate).andThen(orderService);
Response handle(Request request, Handler next) {
    if (!request.authenticated()) return Response.unauthorized();
    return next.handle(request);
}`,
  },
  {
    id:'factory', group:'创建型', name:'Factory Method', zh:'工厂方法',
    intro:'把创建哪种对象的决定交给子类，父类复用处理流程。',
    use:'一套流程需要配合多种产品实现，例如导出不同格式的报表。',
    cost:'每种实现可能多出一个子类。仅需按枚举选实现时可以用简单工厂。',
    nodes:{
      caller:node('报表任务','调用 export()','actor',.15,.49),
      exporter:node('Exporter','统一导出流程','hub',.48,.49),
      pdf:node('PdfExporter','覆盖工厂方法','block',.79,.22),
      writer:node('PdfWriter','implements Writer','gem',.79,.73,true),
    },
    steps:[
      step([['caller','exporter','export(report)']], '运行继承来的导出流程','任务使用 PdfExporter，但公共 export() 定义在父类 Exporter 中。'),
      step([['exporter','pdf','createWriter()']], '工厂方法按实际子类分派','同一个 createWriter() 调用进入 PdfExporter 的实现。'),
      step([['pdf','writer','new PdfWriter()']], '创建具体产品','PdfExporter 构造并返回 PdfWriter。公共流程仅依赖 Writer 接口。',['writer']),
      step([['exporter','writer','write(report)']], '用统一接口写报表','增加 CSV 导出时，可以增加对应的 Exporter 子类和 Writer 实现。'),
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
    id:'builder', group:'创建型', name:'Builder', zh:'建造者模式',
    intro:'分步收集构造参数，最后一次性生成对象。',
    use:'不同配置下对象有多个可选参数，或者需要在创建前验证参数组合。',
    cost:'参数很少时，构造器更直接。Builder 通常按使用方持有，避免跨线程共享可变状态。',
    nodes:{
      caller:node('调用方','配置导出任务','actor',.16,.5),
      builder:node('ExportBuilder','收集参数','stack',.50,.5),
      result:node('ExportJob','不可变结果','gem',.83,.5,true),
    },
    steps:[
      step([['caller','builder','format(PDF)']], '先设定输出格式','Builder 保存格式。此时还没有 ExportJob。',[],{builder:'格式：PDF'}),
      step([['caller','builder','file("sales.pdf")']], '再设置输出文件','可读的方法名说明参数用途，未指定的可选字段继续使用默认值。',[],{builder:'PDF / sales.pdf'}),
      step([['builder','result','build()']], '校验并生成最终对象','build() 检查必填参数并创建不可变的 ExportJob。Builder 状态和结果对象分离。',['result']),
    ],
    code:`ExportJob job = ExportJob.builder()
    .format(Format.PDF)
    .file("sales.pdf")
    .build(); // 检查必填项与参数组合`,
  },
  {
    id:'singleton', group:'创建型', name:'Singleton', zh:'单例模式',
    intro:'多个调用方拿到同一个实例引用。',
    use:'确实需要共享一个进程内资源，且生命周期明确，例如统一配置对象。',
    cost:'全局共享容易隐藏依赖。Java 枚举单例的边界是类加载器，多个进程仍各有实例。',
    nodes:{
      a:node('Service A','第一次获取','actor',.17,.25),
      b:node('Service B','第二次获取','actor',.17,.73),
      entry:node('AppConfig','唯一访问点','hub',.50,.50),
      value:node('INSTANCE','同一个对象','gem',.83,.50,true),
    },
    steps:[
      step([['a','entry','AppConfig.INSTANCE'],['entry','value','类初始化']], '首次访问触发类初始化','Java 枚举常量随类初始化创建。这个场景用对象标识 #1 追踪实例。',['value']),
      step([['value','a','引用 #1']], 'A 拿到实例 #1','调用方取得共享引用。'),
      step([['b','entry','AppConfig.INSTANCE'],['value','b','引用 #1']], 'B 也拿到实例 #1','后续访问复用同一个枚举常量。仍要单独处理实例内可变字段的线程安全。'),
    ],
    code:`enum AppConfig {
    INSTANCE;
}
var a = AppConfig.INSTANCE;
var b = AppConfig.INSTANCE;
assert a == b;`,
  },
  {
    id:'adapter', group:'结构型', name:'Adapter', zh:'适配器模式',
    intro:'让统一的支付接口接上签名和返回值都不同的 PSP。',
    use:'已有组件可以完成任务，但它的接口与业务代码想调用的接口不同。',
    cost:'要约定如何转换支付金额、事件和错误语义。渠道独有能力可以显式声明。',
    nodes:{
      app:node('Billing','统一 PaymentPort','actor',.15,.5),
      adapter:node('PayPalAdapter','转换请求与结果','ring',.49,.5),
      psp:node('PayPal SDK','使用渠道参数','stack',.83,.5),
    },
    steps:[
      step([['app','adapter','createCheckout(order)']], '业务调用统一接口','Billing 只构造自己的 CheckoutRequest，并调用 PaymentPort。'),
      step([['adapter','psp','createOrder(payload)']], '转换为渠道请求','Adapter 将金额、币种和业务订单号转换成 PayPal SDK 需要的结构。'),
      step([['psp','adapter','providerResponse'],['adapter','app','CheckoutResult']], '转换回统一结果','Adapter 提取渠道订单号和跳转链接。Billing 继续按统一结果处理。'),
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
    id:'decorator', group:'结构型', name:'Decorator', zh:'装饰器模式',
    intro:'用同一接口包住对象，每包一层就叠加一项行为。',
    use:'日志、计时、压缩等能力要独立组合，调用方继续使用原有接口。',
    cost:'包裹顺序会影响结果和指标。层数多时，异常栈和调用路径会变长。',
    nodes:{
      client:node('调用方','调用 read()','actor',.13,.39),
      metrics:node('TimedReader','外层 · 计时','ring',.38,.58),
      logs:node('LoggedReader','内层 · 日志','ring',.63,.39),
      file:node('FileReader','读取数据','stack',.86,.58),
    },
    steps:[
      step([['client','metrics','read()']], '调用从最外层进入','TimedReader 和 FileReader 都实现 Reader。TimedReader 记录开始时间。'),
      step([['metrics','logs','delegate.read()'],['logs','file','delegate.read()']], '逐层委托到底层','LoggedReader 记录调用并交给真正读取文件的对象。'),
      step([['file','logs','bytes'],['logs','metrics','bytes'],['metrics','client','bytes']], '返回时逐层执行附加行为','日志层记录结果，计时层计算耗时，调用方收到原接口的返回值。'),
    ],
    code:`Reader reader = new TimedReader(
    new LoggedReader(new FileReader()));
byte[] bytes = reader.read();`,
  },
  {
    id:'facade', group:'结构型', name:'Facade', zh:'外观模式',
    intro:'把多个子系统调用封装成一个贴近业务的入口。',
    use:'调用方经常用相同顺序组合多个子系统，例如提交订单流程。',
    cost:'入口应该聚焦一种业务用途。失败的补偿或事务由流程显式定义。',
    nodes:{
      client:node('客户端','提交订单','actor',.15,.50),
      facade:node('OrderFacade','协调执行','hub',.49,.50),
      stock:node('库存','预留商品','stack',.82,.18),
      payment:node('支付','确认扣款','gem',.82,.50),
      notify:node('通知','发送确认','block',.82,.82),
    },
    steps:[
      step([['client','facade','placeOrder(order)']], '调用方使用一个入口','客户端提交订单。Facade 负责内部调用顺序。'),
      step([['facade','stock','reserve(order)']], '先协调库存','库存预留成功，流程才进入下一站。'),
      step([['facade','payment','charge(order)']], '再确认付款','教学场景演示成功分支。支付失败时，流程应释放库存或进入补偿。'),
      step([['facade','notify','confirm(order)'],['facade','client','receipt']], '确认订单并返回回执','一次业务调用封装了库存、支付和通知三个子系统的交互。'),
    ],
    code:`Receipt placeOrder(Order order) {
    stock.reserve(order);
    // 示例仅展示成功路径
    Receipt receipt = payment.charge(order);
    notification.confirm(order);
    return receipt;
}`,
  },
];
