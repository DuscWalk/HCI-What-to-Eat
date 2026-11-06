import { MEAL_LABEL, type MealSlot } from '../logic/meal';
import { IconChevron, IconPin } from './Icons';

/**
 * 首页顶部（白板：首页上方「弹窗 推荐」入口）。候选入口改为屏幕边缘的浮窗。
 * 容器本身不建立层叠上下文，推荐弹窗的遮罩可以盖住入口。
 */
export function HomeTopBar({
  meal,
  recOpen,
  onRecommend,
}: {
  meal: MealSlot;
  recOpen: boolean;
  onRecommend: () => void;
}) {
  return (
    <header className="home-top">
      <div className="home-loc">
        <IconPin size={15} />
        <span>仙林校区 · 宿舍 4 栋</span>
        <span className="meal-pill">{MEAL_LABEL[meal.kind]}</span>
      </div>
      <div className="home-top-row">
        <button
          type="button"
          className={`rec-entry${recOpen ? ' open' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={recOpen}
          onClick={onRecommend}
        >
          <span className="rec-entry-face" aria-hidden="true">
            😋
          </span>
          <span className="rec-entry-text">
            <b>今天吃什么？</b>
            <small>按口味和预算帮你挑几个</small>
          </span>
          <span className="rec-entry-go">
            帮我挑
            <IconChevron size={14} />
          </span>
        </button>
      </div>
    </header>
  );
}
